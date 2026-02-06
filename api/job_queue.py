"""
작업 대기열 관리 모듈 (인메모리)

동시 요청 시 순차 처리를 위한 대기열 시스템
"""
import threading
import uuid
import os
from collections import deque
from datetime import datetime
from minio import Minio

from config import (
    ORIGINAL_BUCKET,
    USE_EXTERNAL_SEPARATOR,
    MAX_QUEUE_SIZE
)
from services import (
    send_file_to_analysis_server,
    analyze_vocal_pitch_from_minio,
    download_and_save_separated_files,
    separate_audio_locally
)
from storage import generate_presigned_url


# ===== 대기열 상태 (인메모리) =====
job_queue = {}          # {job_id: {status, position, result, file_info, ...}}
waiting_list = deque()  # 대기 중인 job_id 순서
queue_lock = threading.Lock()  # 스레드 안전을 위한 락
job_event = threading.Event()  # 작업 도착 신호 (polling 대신 사용)
worker_thread = None
minio_client = None     # app.py에서 설정


def init_queue(client: Minio):
    """대기열 초기화 (MinIO 클라이언트 설정)"""
    global minio_client
    minio_client = client


def get_position(job_id: str) -> int:
    """대기열에서 현재 위치 반환 (1부터 시작, 없으면 0)"""
    try:
        return list(waiting_list).index(job_id) + 1
    except ValueError:
        return 0


def get_queue_length() -> int:
    """현재 대기열 길이 반환"""
    return len(waiting_list)


def create_job(file_info: dict, vocal_type: str) -> dict:
    """
    새 작업 생성 및 대기열에 추가

    Args:
        file_info: 파일 정보 (original_filename, unique_filename, file_data 등)
        vocal_type: 보컬 타입 (female/male)

    Returns:
        dict: {job_id, status, position, message} 또는 {error, message}
    """
    with queue_lock:
        # 대기열 제한 확인
        if len(waiting_list) >= MAX_QUEUE_SIZE:
            return {
                'error': True,
                'message': f'현재 대기열이 가득 찼습니다 ({MAX_QUEUE_SIZE}명). 잠시 후 다시 시도해주세요.'
            }

        job_id = str(uuid.uuid4())

        job_queue[job_id] = {
            'status': 'waiting',
            'file_info': file_info,
            'vocal_type': vocal_type,
            'result': None,
            'error': None,
            'created_at': datetime.now().isoformat()
        }
        waiting_list.append(job_id)
        position = len(waiting_list)

    # 워커 시작 및 작업 도착 신호
    start_worker()
    job_event.set()  # Worker 쓰레드에 "작업 도착" 신호

    return {
        'job_id': job_id,
        'status': 'waiting',
        'position': position,
        'message': f'현재 대기 인원 중 {position}번째입니다.'
    }


def get_job_status(job_id: str) -> dict:
    """
    작업 상태 조회

    Args:
        job_id: 작업 ID

    Returns:
        dict: 상태 정보 또는 None
    """
    if job_id not in job_queue:
        return None

    job = job_queue[job_id]

    response = {
        'job_id': job_id,
        'status': job['status']
    }

    if job['status'] == 'waiting':
        position = get_position(job_id)
        response['position'] = position
        response['message'] = f'현재 대기 인원 중 {position}번째입니다.'

    elif job['status'] == 'processing':
        response['message'] = '악보 분석 중입니다...'

    elif job['status'] == 'completed':
        response['message'] = '완료되었습니다.'
        response['result'] = job['result']

    elif job['status'] == 'failed':
        response['message'] = '처리 중 오류가 발생했습니다.'
        response['error'] = job['error']

    return response


def process_job(job_id: str):
    """
    단일 작업 처리 (음원 분리 + 분석)

    Args:
        job_id: 작업 ID
    """
    job = job_queue[job_id]
    file_info = job['file_info']
    vocal_type = job['vocal_type']

    try:
        # 1. 음원 분리
        if USE_EXTERNAL_SEPARATOR:
            print(f"[{job_id}] Using external separator (Colab server)")
            analysis_result = send_file_to_analysis_server(
                file_info['file_data'],
                file_info['unique_filename'],
                file_info['content_type']
            )
            saved_files = download_and_save_separated_files(
                analysis_result,
                file_info['separated_folder'],
                minio_client
            )
        else:
            print(f"[{job_id}] Using local demucs separator")
            saved_files = separate_audio_locally(
                file_info['file_data'],
                file_info['unique_filename'],
                file_info['separated_folder'],
                minio_client
            )

        # 2. 음정 분석
        pitch_data = None
        if saved_files.get('vocal_object_name'):
            pitch_data = analyze_vocal_pitch_from_minio(
                saved_files['vocal_object_name'],
                minio_client
            )

        # 3. 클레프 결정
        clef = 'treble' if vocal_type == 'female' else 'bass'

        # 4. Presigned URL 생성
        file_presigned_url = generate_presigned_url(
            minio_client,
            ORIGINAL_BUCKET,
            file_info['unique_filename'],
            expires_hours=24
        )

        # 5. 결과 저장
        filename_without_ext = os.path.splitext(file_info['original_filename'])[0]

        result = {
            'clef': clef,
            'original_filename': filename_without_ext,
            'file_url': file_presigned_url,
            'notes': pitch_data
        }

        with queue_lock:
            job_queue[job_id]['status'] = 'completed'
            job_queue[job_id]['result'] = result

        print(f"[{job_id}] Job completed successfully")

    except Exception as e:
        print(f"[{job_id}] Job failed: {str(e)}")
        with queue_lock:
            job_queue[job_id]['status'] = 'failed'
            job_queue[job_id]['error'] = str(e)


def process_worker():
    """백그라운드에서 대기열 순차 처리 (Event 기반)"""
    while True:
        # 작업 도착 신호 대기 (CPU 사용 0)
        job_event.wait()

        while True:
            job_id = None

            with queue_lock:
                if waiting_list:
                    job_id = waiting_list[0]
                    if job_id in job_queue:
                        job_queue[job_id]['status'] = 'processing'
                else:
                    # 대기열 비어있으면 신호 초기화 후 대기 상태로
                    job_event.clear()
                    break

            if job_id is None:
                break

            # 작업 처리
            process_job(job_id)

            # 완료 후 대기열에서 제거
            with queue_lock:
                if waiting_list and waiting_list[0] == job_id:
                    waiting_list.popleft()


def start_worker():
    """워커 스레드 시작"""
    global worker_thread
    if worker_thread is None or not worker_thread.is_alive():
        worker_thread = threading.Thread(target=process_worker, daemon=True)
        worker_thread.start()
        print("Job queue worker started")

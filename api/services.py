import os
import uuid
import requests
from datetime import datetime
from io import BytesIO
from minio import Minio

from config import (
    MINIO_PUBLIC_ENDPOINT,
    ANALYSIS_SERVER_URL,
    SEPARATED_BUCKET
)
from utils import extract_pitch_info


def save_uploaded_file(file, minio_client: Minio, bucket_name: str):
    """
    업로드된 파일을 MinIO에 저장
    
    Args:
        file: Flask request.files에서 받은 파일 객체
        minio_client: MinIO 클라이언트 인스턴스
        bucket_name: 저장할 버킷 이름
    
    Returns:
        dict: 파일 정보 (unique_filename, separated_folder, file_data, content_type)
    """
    # timestamp + UUID로 고유한 파일명 생성
    ext = os.path.splitext(file.filename)[1].lower()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]  # UUID의 앞 8자리만 사용
    unique_filename = f"{timestamp}_{unique_id}{ext}"
    
    # 파일을 메모리에서 읽어 MinIO에 업로드
    file_data = file.read()
    file_size = len(file_data)
    file_stream = BytesIO(file_data)
    
    # MinIO에 원본 파일 업로드
    minio_client.put_object(
        bucket_name,
        unique_filename,
        file_stream,
        file_size,
        content_type=file.content_type or 'application/octet-stream'
    )
    
    # 확장자 제거한 파일명 (처리된 파일 저장용 폴더명)
    filename_without_ext = os.path.splitext(unique_filename)[0]

    return {
        'unique_filename': unique_filename,
        'separated_folder': filename_without_ext,
        'file_data': file_data,  # 다른 서버로 전송하기 위해 추가
        'content_type': file.content_type or 'application/octet-stream'
    }


def send_file_to_analysis_server(file_data: bytes, filename: str, content_type: str):
    """
    분석 서버로 파일을 전송하고 분석 결과를 받음
    
    Args:
        file_data: 파일 바이너리 데이터
        filename: 파일명
        content_type: 파일 컨텐츠 타입
    
    Returns:
        dict: 분석 서버 응답 결과
    
    Raises:
        Exception: 분석 서버 통신 실패 시
    """
    try:
        # 파일을 multipart/form-data로 전송
        files = {
            'music_file': (filename, BytesIO(file_data), content_type)
        }
        
        # 분석 서버로 POST 요청
        response = requests.post(
            f"{ANALYSIS_SERVER_URL}/v2/tracks/analyze",
            files=files,
            timeout=540  # 9분 타임아웃 (nginx 10분보다 1분 짧게 설정)
        )
        
        response.raise_for_status()  # HTTP 에러 발생 시 예외 발생
        return response.json()
    
    except requests.exceptions.Timeout:
        raise Exception('분석 서버 응답 시간 초과')
    except requests.exceptions.ConnectionError:
        raise Exception('분석 서버 연결 실패')
    except requests.exceptions.RequestException as e:
        raise Exception(f'분석 서버 요청 중 오류: {str(e)}')


def analyze_vocal_pitch_from_minio(vocal_object_name: str, minio_client: Minio):
    """
    MinIO에 저장된 vocal 파일을 다운로드하여 음정 분석 수행
    
    Args:
        vocal_object_name: MinIO의 vocal 파일 경로 (예: "separated/20240118_123456/vocal.wav")
        minio_client: MinIO 클라이언트 인스턴스
    
    Returns:
        list: 음정 분석 결과 리스트
    
    Raises:
        Exception: MinIO 다운로드 또는 피치 분석 실패 시
    """
    temp_vocal_path = None
    try:
        # MinIO에서 파일 다운로드
        response = minio_client.get_object(SEPARATED_BUCKET, vocal_object_name)
        vocal_data = response.read()
        response.close()
        response.release_conn()
        
        # 임시 파일로 저장
        temp_vocal_path = f"/tmp/temp_vocal_{uuid.uuid4()}.wav"
        with open(temp_vocal_path, 'wb') as f:
            f.write(vocal_data)
        
        # 피치 분석
        pitch_data = extract_pitch_info(temp_vocal_path)
        print(f"Pitch analysis completed: {len(pitch_data)} notes found")
        
        return pitch_data
        
    finally:
        # 임시 파일 삭제
        if temp_vocal_path and os.path.exists(temp_vocal_path):
            try:
                os.remove(temp_vocal_path)
            except Exception as e:
                print(f"Failed to remove temp file: {str(e)}")


def download_and_save_separated_files(analysis_result: dict, separated_folder: str, minio_client: Minio):
    """
    분석 서버에서 분리된 vocal/mr 파일을 다운로드하여 MinIO에 저장
    
    Args:
        analysis_result: 분석 서버 응답 결과 (vocal_url, mr_url 포함)
        separated_folder: MinIO에 저장할 폴더명
        minio_client: MinIO 클라이언트 인스턴스
    
    Returns:
        dict: 저장된 파일 정보 {'vocal_minio_url': str, 'vocal_object_name': str, 'mr_minio_url': str}
    
    Raises:
        Exception: 파일 다운로드 또는 저장 실패 시
    """
    saved_files = {
        'vocal_minio_url': None,
        'vocal_object_name': None,
        'mr_minio_url': None
    }
    
    # vocal 파일 다운로드 및 저장
    if 'vocal_url' in analysis_result:
        vocal_url = f"{ANALYSIS_SERVER_URL}{analysis_result['vocal_url']}"
        print(f"Downloading vocal from: {vocal_url}")
        
        # 파일 다운로드
        response = requests.get(vocal_url, timeout=60)
        response.raise_for_status()
        
        vocal_data = response.content
        
        # MinIO에 저장
        vocal_object_name = f"{separated_folder}/vocal.wav"
        
        minio_client.put_object(
            SEPARATED_BUCKET,
            vocal_object_name,
            BytesIO(vocal_data),
            len(vocal_data),
            content_type='audio/wav'
        )
        
        saved_files['vocal_minio_url'] = f"{MINIO_PUBLIC_ENDPOINT}/{SEPARATED_BUCKET}/{vocal_object_name}"
        saved_files['vocal_object_name'] = vocal_object_name  # 피치 분석을 위해 저장
    
    # mr 파일 다운로드 및 저장
    if 'mr_url' in analysis_result:
        mr_url = f"{ANALYSIS_SERVER_URL}{analysis_result['mr_url']}"
        
        # 파일 다운로드
        response = requests.get(mr_url, timeout=60)
        response.raise_for_status()
        
        # MinIO에 저장
        mr_data = response.content
        mr_object_name = f"{separated_folder}/mr.wav"
        
        minio_client.put_object(
            SEPARATED_BUCKET,
            mr_object_name,
            BytesIO(mr_data),
            len(mr_data),
            content_type='audio/wav'
        )
        
        saved_files['mr_minio_url'] = f"{MINIO_PUBLIC_ENDPOINT}/{SEPARATED_BUCKET}/{mr_object_name}"
    
    return saved_files


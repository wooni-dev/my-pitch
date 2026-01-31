import os
import uuid
import requests
from datetime import datetime
from io import BytesIO
from minio import Minio

from config import (
    ANALYSIS_SERVER_URL,
    SEPARATED_BUCKET,
    TEMP_UPLOAD_FOLDER,
    TEMP_OUTPUT_FOLDER
)
from utils import extract_pitch_info
from storage import generate_presigned_url


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
        'original_filename': file.filename,
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
        
        # Presigned URL 생성 (24시간 유효)
        saved_files['vocal_minio_url'] = generate_presigned_url(
            minio_client,
            SEPARATED_BUCKET,
            vocal_object_name,
            expires_hours=24
        )
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
        
        # Presigned URL 생성 (24시간 유효)
        saved_files['mr_minio_url'] = generate_presigned_url(
            minio_client,
            SEPARATED_BUCKET,
            mr_object_name,
            expires_hours=24
        )
    
    return saved_files


def separate_audio_locally(file_data: bytes, unique_filename: str, separated_folder: str, minio_client: Minio):
    """
    로컬에서 demucs를 사용하여 보컬/MR 분리 후 MinIO에 저장
    
    Args:
        file_data: 원본 파일 바이너리 데이터
        unique_filename: 원본 파일명 (확장자 포함)
        separated_folder: MinIO에 저장할 폴더명
        minio_client: MinIO 클라이언트 인스턴스
    
    Returns:
        dict: 저장된 파일 정보 {'vocal_minio_url': str, 'vocal_object_name': str, 'mr_minio_url': str}
    
    Raises:
        Exception: demucs 실행 또는 파일 저장 실패 시
    """
    # 배포 환경에서만 사용되는 패키지 (로컬 개발 환경에는 설치되지 않음)
    # Docker 컨테이너에는 설치되어 있으므로 IDE 경고 무시
    import torch as th  # pyright: ignore[reportMissingImports]
    import soundfile as sf  # pyright: ignore[reportMissingImports]
    from demucs import pretrained  # pyright: ignore[reportMissingImports]
    from demucs.apply import apply_model  # pyright: ignore[reportMissingImports]
    from demucs.audio import AudioFile  # pyright: ignore[reportMissingImports]
    
    temp_input_path = None
    temp_output_dir = None
    
    try:
        # 임시 디렉토리 생성
        os.makedirs(TEMP_UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(TEMP_OUTPUT_FOLDER, exist_ok=True)
        
        # 1. 입력 파일을 임시 저장
        temp_input_path = os.path.join(TEMP_UPLOAD_FOLDER, unique_filename)
        with open(temp_input_path, 'wb') as f:
            f.write(file_data)
        
        # 2. 출력 디렉토리 생성
        temp_output_dir = os.path.join(TEMP_OUTPUT_FOLDER, separated_folder)
        os.makedirs(temp_output_dir, exist_ok=True)
        
        # 3. demucs 모델 로드 및 실행
        print(f"Loading demucs model...")
        device = th.device('cuda') if th.cuda.is_available() else th.device('cpu')
        print(f"Using device: {device}")
        
        model = pretrained.get_model(name='htdemucs_ft')
        model.to(device)
        model.eval()
        
        # 4. 오디오 파일 읽기
        print(f"Reading audio file: {temp_input_path}")
        audio_file_obj = AudioFile(temp_input_path)
        mix = audio_file_obj.read(
            samplerate=model.samplerate,
            channels=model.audio_channels
        )
        
        if mix.numel() == 0:
            raise ValueError(f"입력 오디오 파일이 비어있거나 손상되었습니다.")
        
        mix = mix.to(device)
        
        # 배치 차원 추가
        if mix.ndim == 2:
            mix = mix[None]
        elif mix.ndim != 3:
            raise ValueError(f"입력 오디오 텐서 차원 오류: {mix.ndim}차원 (예상: 2D 또는 3D)")
        
        if len(mix.shape) != 3:
            raise ValueError(f"처리 후 mix 텐서가 3차원 (batch, channels, samples)을 가져야 하지만, {len(mix.shape)}차원과 형태 {mix.shape}를 가집니다. 현재 mix 형태는 {mix.shape}입니다. 이는 입력 오디오 파일 또는 Demucs.AudioFile.read()에서 로드하는 데 문제가 있음을 나타냅니다.")
        
        # 5. 소스 분리 실행
        print(f"Separating audio sources...")
        separated_stems = apply_model(model, mix, shifts=3, progress=False, device=device)[0]
        
        # 6. vocal과 MR 추출
        vocal_idx = model.sources.index('vocals')
        vocal_tensor = separated_stems[vocal_idx]
        
        mr_indices = [i for i, s in enumerate(model.sources) if s != 'vocals']
        mr_tensor = separated_stems[mr_indices].sum(dim=0)
        
        # 7. 임시 파일로 저장
        temp_vocal_path = os.path.join(temp_output_dir, 'vocal.wav')
        temp_mr_path = os.path.join(temp_output_dir, 'mr.wav')
        
        # soundfile을 사용하여 저장 (torchcodec 의존성 제거)
        # tensor를 numpy 배열로 변환 (channels, samples) -> (samples, channels)
        vocal_numpy = vocal_tensor.cpu().numpy().T
        mr_numpy = mr_tensor.cpu().numpy().T
        
        sf.write(temp_vocal_path, vocal_numpy, model.samplerate, subtype='PCM_16')
        sf.write(temp_mr_path, mr_numpy, model.samplerate, subtype='PCM_16')
        
        print(f"Audio separation completed")
        
        # 8. MinIO에 업로드
        saved_files = {
            'vocal_minio_url': None,
            'vocal_object_name': None,
            'mr_minio_url': None
        }
        
        # vocal 파일 업로드
        with open(temp_vocal_path, 'rb') as f:
            vocal_data = f.read()
        
        vocal_object_name = f"{separated_folder}/vocal.wav"
        minio_client.put_object(
            SEPARATED_BUCKET,
            vocal_object_name,
            BytesIO(vocal_data),
            len(vocal_data),
            content_type='audio/wav'
        )
        # Presigned URL 생성 (24시간 유효)
        saved_files['vocal_minio_url'] = generate_presigned_url(
            minio_client,
            SEPARATED_BUCKET,
            vocal_object_name,
            expires_hours=24
        )
        saved_files['vocal_object_name'] = vocal_object_name
        print(f"Uploaded vocal to MinIO: {vocal_object_name}")
        
        # MR 파일 업로드
        with open(temp_mr_path, 'rb') as f:
            mr_data = f.read()
        
        mr_object_name = f"{separated_folder}/mr.wav"
        minio_client.put_object(
            SEPARATED_BUCKET,
            mr_object_name,
            BytesIO(mr_data),
            len(mr_data),
            content_type='audio/wav'
        )
        # Presigned URL 생성 (24시간 유효)
        saved_files['mr_minio_url'] = generate_presigned_url(
            minio_client,
            SEPARATED_BUCKET,
            mr_object_name,
            expires_hours=24
        )
        print(f"Uploaded MR to MinIO: {mr_object_name}")
        
        return saved_files
        
    finally:
        # 9. 임시 파일 정리
        try:
            if temp_input_path and os.path.exists(temp_input_path):
                os.remove(temp_input_path)
            if temp_output_dir and os.path.exists(temp_output_dir):
                import shutil
                shutil.rmtree(temp_output_dir)
        except Exception as e:
            print(f"Failed to clean up temp files: {str(e)}")


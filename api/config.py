import os
import sys

# MinIO 설정
MINIO_ENDPOINT = os.environ.get('MINIO_ENDPOINT', 'fileserver:9000')  # 서버 내부 연결용
MINIO_PUBLIC_ENDPOINT = os.environ.get('MINIO_PUBLIC_ENDPOINT', 'http://files.my-pitch')  # 브라우저 다운로드용
MINIO_ACCESS_KEY = os.environ.get('MINIO_ROOT_USER', 'minioadmin')
MINIO_SECRET_KEY = os.environ.get('MINIO_ROOT_PASSWORD', 'minioadmin')

# 버킷 설정
ORIGINAL_BUCKET = os.environ.get('ORIGINAL_BUCKET', 'original-tracks')  # 원본 파일 저장
SEPARATED_BUCKET = os.environ.get('SEPARATED_BUCKET', 'separated-tracks')  # vocal, mr 분리 파일 저장

# 파일 업로드 설정 (demucs 호환 형식만 지원)
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'flac', 'ogg'}
MAX_FILE_SIZE_MB = int(os.environ.get('MAX_FILE_SIZE_MB', '7'))
MAX_QUEUE_SIZE = int(os.environ.get('MAX_QUEUE_SIZE', '3'))

# 음원 분리 방식 설정
# True: 외부 서버(Colab) 사용 (개발 환경)
# False: 로컬에서 demucs 직접 실행 (배포 환경)
USE_EXTERNAL_SEPARATOR = os.environ.get('USE_EXTERNAL_SEPARATOR', 'false').lower() == 'true'

# 환경별 설정값
if USE_EXTERNAL_SEPARATOR:
    # 개발 환경: 외부 서버 URL 필수
    ANALYSIS_SERVER_URL = os.environ.get('ANALYSIS_SERVER_URL')
    if not ANALYSIS_SERVER_URL:
        print("❌ [DEV 환경 오류] ANALYSIS_SERVER_URL 환경변수가 설정되지 않았습니다.")
        print("   외부 분리 서버를 사용하려면 ANALYSIS_SERVER_URL을 설정해주세요.")
        sys.exit(1)
    
    # DEV 환경에서는 로컬 임시 폴더 불필요 (None으로 설정)
    TEMP_UPLOAD_FOLDER = None
    TEMP_OUTPUT_FOLDER = None
    print(f"🌐 [DEV 환경] 외부 서버 사용: {ANALYSIS_SERVER_URL}")
    
else:
    # 배포 환경: 로컬 임시 폴더 필수
    TEMP_UPLOAD_FOLDER = os.environ.get('TEMP_UPLOAD_FOLDER')
    TEMP_OUTPUT_FOLDER = os.environ.get('TEMP_OUTPUT_FOLDER')
    
    if not TEMP_UPLOAD_FOLDER or not TEMP_OUTPUT_FOLDER:
        print("❌ [PROD 환경 오류] TEMP_UPLOAD_FOLDER 또는 TEMP_OUTPUT_FOLDER 환경변수가 설정되지 않았습니다.")
        print("   로컬 demucs를 사용하려면 임시 파일 경로를 설정해주세요.")
        sys.exit(1)
    
    # PROD 환경에서는 외부 서버 URL 불필요 (None으로 설정)
    ANALYSIS_SERVER_URL = None
    print(f"🏠 [PROD 환경] 로컬 demucs 사용: {TEMP_UPLOAD_FOLDER}, {TEMP_OUTPUT_FOLDER}")


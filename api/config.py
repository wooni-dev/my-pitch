import os

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

# 외부 API 서버 설정 (개발 환경용)
ANALYSIS_SERVER_URL = os.environ.get('ANALYSIS_SERVER_URL', 'https://6e37648a7e67ec.lhr.life')

# 음원 분리 방식 설정
# True: 외부 서버(Colab) 사용 (개발 환경)
# False: 로컬에서 demucs 직접 실행 (배포 환경)
USE_EXTERNAL_SEPARATOR = os.environ.get('USE_EXTERNAL_SEPARATOR', 'false').lower() == 'true'

# 로컬 demucs 실행 시 임시 파일 저장 경로
TEMP_UPLOAD_FOLDER = os.environ.get('TEMP_UPLOAD_FOLDER', '/tmp/uploads')
TEMP_OUTPUT_FOLDER = os.environ.get('TEMP_OUTPUT_FOLDER', '/tmp/outputs')


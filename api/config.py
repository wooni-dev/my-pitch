import os

# MinIO 설정
MINIO_ENDPOINT = os.environ.get('MINIO_ENDPOINT', 'fileserver:9000')
MINIO_ACCESS_KEY = os.environ.get('MINIO_ROOT_USER', 'minioadmin')
MINIO_SECRET_KEY = os.environ.get('MINIO_ROOT_PASSWORD', 'minioadmin')

# 버킷 설정
ORIGINAL_BUCKET = os.environ.get('ORIGINAL_BUCKET', 'original-tracks')  # 원본 파일 저장
SEPARATED_BUCKET = os.environ.get('SEPARATED_BUCKET', 'separated-tracks')  # vocal, mr 분리 파일 저장

# 파일 업로드 설정
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'}
MAX_FILE_SIZE_MB = int(os.environ.get('MAX_FILE_SIZE_MB', '50'))

# 외부 API 서버 설정
ANALYSIS_SERVER_URL = os.environ.get('ANALYSIS_SERVER_URL', 'https://6e37648a7e67ec.lhr.life')


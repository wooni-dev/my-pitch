from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import re
import uuid
from datetime import datetime
from minio import Minio
from minio.error import S3Error
from io import BytesIO

app = Flask(__name__)
CORS(app)

# MinIO 설정
MINIO_ENDPOINT = os.environ.get('MINIO_ENDPOINT', 'fileserver:9000')
MINIO_ACCESS_KEY = os.environ.get('MINIO_ROOT_USER', 'minioadmin')
MINIO_SECRET_KEY = os.environ.get('MINIO_ROOT_PASSWORD', 'minioadmin')
MINIO_BUCKET = os.environ.get('MINIO_BUCKET', 'music-tracks')

# 파일 업로드 설정
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'}
MAX_FILE_SIZE_MB = int(os.environ.get('MAX_FILE_SIZE_MB', '50'))
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE_MB * 1024 * 1024

# MinIO 클라이언트 초기화
minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False  # HTTP 사용 (개발 환경)
)

# 버킷 생성 (없으면)
try:
    if not minio_client.bucket_exists(MINIO_BUCKET):
        minio_client.make_bucket(MINIO_BUCKET)
        print(f"버킷 '{MINIO_BUCKET}' 생성 완료")
except S3Error as e:
    print(f"버킷 확인/생성 중 오류: {e}")

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def hello_world():
    return jsonify({
        'message': 'Hello World',
        'status': 'success'
    })

@app.route('/v1/tracks/analyze', methods=['POST'])
def analyze_track():
    # 1. 파일 업로드 및 저장 (MinIO)
    if 'music_file' not in request.files:
        return jsonify({
            'error': '음악 파일이 없습니다',
            'status': 'error'
        }), 400
    
    file = request.files['music_file']
    
    if file.filename == '':
        return jsonify({
            'error': '파일이 선택되지 않았습니다',
            'status': 'error'
        }), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            'error': '허용되지 않는 파일 형식입니다',
            'status': 'error'
        }), 400
    
    # 안전한 파일명 생성 (UUID + 타임스탬프)
    original_filename = secure_filename(file.filename)
    name, ext = os.path.splitext(original_filename)
    
    # 특수문자/공백 제거 (영숫자와 한글만 남김)
    name = re.sub(r'[^a-zA-Z0-9가-힣]', '', name)
    
    # 파일명이 비어있거나 너무 긴 경우 처리
    if not name or len(name) == 0:
        name = "audio_file"
    elif len(name) > 50:
        name = name[:50]
    
    # UUID와 타임스탬프로 고유한 파일명 생성
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]  # UUID의 앞 8자리만 사용
    unique_filename = f"{name}_{timestamp}_{unique_id}{ext}"
    
    try:
        # 파일을 메모리에서 읽어 MinIO에 업로드
        file_data = file.read()
        file_size = len(file_data)
        file_stream = BytesIO(file_data)
        
        # MinIO에 업로드
        minio_client.put_object(
            MINIO_BUCKET,
            unique_filename,
            file_stream,
            file_size,
            content_type=file.content_type or 'application/octet-stream'
        )
        
        # 파일 URL 생성
        file_url = f"http://{MINIO_ENDPOINT}/{MINIO_BUCKET}/{unique_filename}"
        
        return jsonify({
            'message': '파일이 성공적으로 업로드되었습니다',
            'status': 'success',
            'filename': unique_filename,
            'bucket': MINIO_BUCKET,
            'file_url': file_url,
            'file_size': file_size
        }), 200
    
    except S3Error as e:
        return jsonify({
            'error': f'MinIO 저장 중 오류 발생: {str(e)}',
            'status': 'error'
        }), 500
    
    except Exception as e:
        return jsonify({
            'error': f'파일 처리 중 오류 발생: {str(e)}',
            'status': 'error'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)


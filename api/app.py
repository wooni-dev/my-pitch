from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import uuid
import requests
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

# 버킷 설정
ORIGINAL_BUCKET = os.environ.get('ORIGINAL_BUCKET', 'original-tracks')  # 원본 파일 저장
SEPARATED_BUCKET = os.environ.get('SEPARATED_BUCKET', 'separated-tracks')  # vocal, mr 분리 파일 저장

# 파일 업로드 설정
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'}
MAX_FILE_SIZE_MB = int(os.environ.get('MAX_FILE_SIZE_MB', '50'))
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE_MB * 1024 * 1024

# 외부 API 서버 설정
ANALYSIS_SERVER_URL = os.environ.get('ANALYSIS_SERVER_URL', 'https://6e37648a7e67ec.lhr.life')

# MinIO 클라이언트 초기화
# https://docs.min.io/enterprise/aistor-object-store/developers/sdk/python/api/#1-constructor
minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False  # HTTP 사용 (개발 환경)
)

# 버킷 생성 (없으면)
buckets = [ORIGINAL_BUCKET, SEPARATED_BUCKET]
for bucket_name in buckets:
    try:
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)
            print(f"버킷 '{bucket_name}' 생성 완료")
    except S3Error as e:
        print(f"버킷 '{bucket_name}' 확인/생성 중 오류: {e}")

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_uploaded_file(file_key='music_file'):
    # 파일 존재 확인
    if file_key not in request.files:
        return (jsonify({
            'message': '음악 파일이 없습니다',
        }), 400)
    
    file = request.files[file_key]
    
    # 파일명 확인
    if file.filename == '':
        return (jsonify({
            'message': '파일이 선택되지 않았습니다',
        }), 400)
    
    # 파일 형식 확인
    if not allowed_file(file.filename):
        return (jsonify({
            'message': '허용되지 않는 파일 형식입니다',
        }), 400)
    
    # 유효성 검사 통과
    return (file, None)

@app.route('/')
def hello_world():
    return jsonify({
        'message': 'Hello World',
        'status': 'success'
    })

def save_uploaded_file(file):
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
        ORIGINAL_BUCKET,
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

def send_file_to_analysis_server(file_data, filename, content_type):
    try:
        # 파일을 multipart/form-data로 전송
        files = {
            'music_file': (filename, BytesIO(file_data), content_type)
        }
        
        # 분석 서버로 POST 요청
        response = requests.post(
            f"{ANALYSIS_SERVER_URL}/v2/tracks/analyze",
            files=files,
            timeout=300  # 5분 타임아웃 (분석 작업이 오래 걸릴 수 있음)
        )
        
        response.raise_for_status()  # HTTP 에러 발생 시 예외 발생
        return response.json()
    
    except requests.exceptions.Timeout:
        raise Exception('분석 서버 응답 시간 초과')
    except requests.exceptions.ConnectionError:
        raise Exception('분석 서버 연결 실패')
    except requests.exceptions.RequestException as e:
        raise Exception(f'분석 서버 요청 중 오류: {str(e)}')

def download_and_save_separated_files(analysis_result, separated_folder):
    saved_files = {}
    
    # vocal 파일 다운로드 및 저장
    if 'vocal_url' in analysis_result:
        try:
            vocal_url = f"{ANALYSIS_SERVER_URL}{analysis_result['vocal_url']}"
            print(f"Downloading vocal from: {vocal_url}")
            
            # 파일 다운로드
            response = requests.get(vocal_url, timeout=60)
            response.raise_for_status()
            
            # MinIO에 저장
            vocal_data = response.content
            vocal_object_name = f"{separated_folder}/vocal.wav"
            
            minio_client.put_object(
                SEPARATED_BUCKET,
                vocal_object_name,
                BytesIO(vocal_data),
                len(vocal_data),
                content_type='audio/wav'
            )
            
            saved_files['vocal_minio_url'] = f"http://{MINIO_ENDPOINT}/{SEPARATED_BUCKET}/{vocal_object_name}"
            print(f"Vocal saved to MinIO: {vocal_object_name}")
            
        except Exception as e:
            print(f"Vocal 파일 저장 실패: {str(e)}")
            saved_files['vocal_error'] = str(e)
    
    # mr 파일 다운로드 및 저장
    if 'mr_url' in analysis_result:
        try:
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
            
            saved_files['mr_minio_url'] = f"http://{MINIO_ENDPOINT}/{SEPARATED_BUCKET}/{mr_object_name}"
            
        except Exception as e:
            print(f"MR 파일 저장 실패: {str(e)}")
            saved_files['mr_error'] = str(e)
    
    return saved_files

@app.route('/v1/tracks/analyze', methods=['POST'])
def analyze_track():
    # 1. 파일 유효성 검사
    file, error = validate_uploaded_file('music_file')
    if error:
        return file  # error가 있으면 file에 error response가 들어있음
    
    # 2. 파일 저장
    try:
        file_info = save_uploaded_file(file)
        
        # 3. 분석 서버로 파일 전송
        try:
            analysis_result = send_file_to_analysis_server(
                file_info['file_data'],
                file_info['unique_filename'],
                file_info['content_type']
            )
            
            # 4. 분리된 파일 다운로드 및 MinIO에 저장
            download_and_save_separated_files(
                analysis_result,
                file_info['separated_folder']
            )
            
            return jsonify({
                'message': '파일이 성공적으로 업로드되고 분리되었습니다',
            }), 200
            
        except Exception as e:
            return jsonify({
                'message': '파일은 저장되었으나 분석 서버 전송 실패',
            }), 502
    
    except S3Error as e:
        return jsonify({
            'error': f'MinIO 저장 중 오류 발생: {str(e)}',
        }), 500
    
    except Exception as e:
        return jsonify({
            'error': f'파일 처리 중 오류 발생: {str(e)}',
            'status': 'error'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)


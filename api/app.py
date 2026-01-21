from flask import Flask, jsonify, request
from flask_cors import CORS
from minio import Minio
from minio.error import S3Error
import json

from config import (
    MINIO_ENDPOINT,
    MINIO_PUBLIC_ENDPOINT,
    MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY,
    ORIGINAL_BUCKET,
    SEPARATED_BUCKET,
    MAX_FILE_SIZE_MB
)
from validators import validate_uploaded_file
from services import (
    save_uploaded_file,
    send_file_to_analysis_server,
    analyze_vocal_pitch_from_minio,
    download_and_save_separated_files
)
from utils import determine_clef

app = Flask(__name__)
CORS(app)

# Flask 설정
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE_MB * 1024 * 1024

# MinIO 클라이언트 초기화
# https://docs.min.io/enterprise/aistor-object-store/developers/sdk/python/api/#1-constructor
minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False  # HTTP 사용 (개발 환경)
)

# 버킷 생성 및 public read 권한 설정
buckets = [ORIGINAL_BUCKET, SEPARATED_BUCKET]
for bucket_name in buckets:
    try:
        # 버킷이 없으면 생성
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)
            print(f"버킷 '{bucket_name}' 생성 완료")
    except S3Error as e:
        print(f"버킷 '{bucket_name}' 확인/생성 중 오류: {e}")

@app.route('/')
def hello_world():
    return jsonify({
        'message': 'Hello World',
    })

@app.route('/v1/tracks/analyze', methods=['POST'])
def analyze_track():
    # 1. 파일 유효성 검사
    file, error = validate_uploaded_file('music_file')
    if error:
        return file  # error가 있으면 file에 error response가 들어있음
    
    # 2. 파일 저장
    try:
        file_info = save_uploaded_file(file, minio_client, ORIGINAL_BUCKET)
        
        try:
            # 3. 분석 서버로 파일 전송
            analysis_result = send_file_to_analysis_server(
                file_info['file_data'],
                file_info['unique_filename'],
                file_info['content_type']
            )
            
            # 4. 분리된 파일 다운로드 및 MinIO에 저장
            saved_files = download_and_save_separated_files(
                analysis_result,
                file_info['separated_folder'],
                minio_client
            )
                
            # 5. 음정 분석
            pitch_data = None
            if saved_files.get('vocal_object_name'):
                pitch_data = analyze_vocal_pitch_from_minio(saved_files['vocal_object_name'], minio_client)

            # 6. 클레프 결정
            clef = determine_clef(pitch_data)

            # 7. 응답 데이터 구성
            response_data = {
                'clef': clef,
                'file_url': f"{MINIO_PUBLIC_ENDPOINT}/{ORIGINAL_BUCKET}/{file_info['unique_filename']}",
                'notes': pitch_data
            }
            
            return jsonify(response_data), 200
            
        except Exception as e:
            return jsonify({
                'message': '파일은 저장되었으나 분석 서버 전송 실패',
            }), 502
    
    except S3Error as e:
        return jsonify({
            'message': f'MinIO 저장 중 오류 발생: {str(e)}'
        }), 500
    
    except Exception as e:
        return jsonify({
            'message': f'파일 처리 중 오류 발생: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)


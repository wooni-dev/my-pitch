from flask import Flask, jsonify, request
from flask_cors import CORS
from minio.error import S3Error
import os

from config import (
    MINIO_PUBLIC_ENDPOINT,
    ORIGINAL_BUCKET,
    MAX_FILE_SIZE_MB,
    USE_EXTERNAL_SEPARATOR
)
from validators import validate_uploaded_file
from services import (
    save_uploaded_file,
    send_file_to_analysis_server,
    analyze_vocal_pitch_from_minio,
    download_and_save_separated_files,
    separate_audio_locally
)
from storage import setup_storage, generate_presigned_url

app = Flask(__name__)
CORS(app)

# Flask 설정
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE_MB * 1024 * 1024

# MinIO 클라이언트 초기화 (버킷 설정 포함)
minio_client = setup_storage()

# 파일 크기 초과 에러 핸들러
@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        'message': f'파일 크기가 {MAX_FILE_SIZE_MB}MB를 초과했습니다. 더 작은 파일을 업로드해주세요.'
    }), 413

@app.route('/')
def hello_world():
    return jsonify({
        'message': 'Hello World',
    })

@app.route('/tracks/analyze', methods=['POST'])
def analyze_track():
    # 1. 파일 유효성 검사
    file, error = validate_uploaded_file('music_file')
    if error:
        return file  # error가 있으면 file에 error response가 들어있음
    
    # 1-1. vocal_type 파라미터 받기 (기본값: female)
    vocal_type = request.form.get('vocal_type', 'female')
    
    # 2. 파일 저장
    try:
        file_info = save_uploaded_file(file, minio_client, ORIGINAL_BUCKET)
        
        try:
            # 3. 음원 분리 (환경 변수에 따라 분기)
            if USE_EXTERNAL_SEPARATOR:
                # 개발 환경: 외부 서버(Colab)로 요청
                print("Using external separator (Colab server)")
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
                # 배포 환경: 로컬에서 demucs 직접 실행
                print("Using local demucs separator")
                saved_files = separate_audio_locally(
                    file_info['file_data'],
                    file_info['unique_filename'],
                    file_info['separated_folder'],
                    minio_client
                )
                
            # 4. 음정 분석
            pitch_data = None
            if saved_files.get('vocal_object_name'):
                pitch_data = analyze_vocal_pitch_from_minio(saved_files['vocal_object_name'], minio_client)

            # 5. 클레프 결정 (사용자가 선택한 vocal_type 기반)
            # female → treble, male → bass
            clef = 'treble' if vocal_type == 'female' else 'bass'

            # 6. 응답 데이터 구성
            filename_without_ext = os.path.splitext(file_info['original_filename'])[0]
            
            # Presigned URL 생성 (24시간 동안 유효)
            file_presigned_url = generate_presigned_url(
                minio_client,
                ORIGINAL_BUCKET,
                file_info['unique_filename'],
                expires_hours=24
            )
            
            response_data = {
                'clef': clef,
                'original_filename': filename_without_ext,
                'file_url': file_presigned_url,  # Presigned URL 사용
                'notes': pitch_data
            }
            
            return jsonify(response_data), 200
            
        except Exception as e:
            error_msg = '파일은 저장되었으나 음원 분리 실패' if USE_EXTERNAL_SEPARATOR else '파일은 저장되었으나 로컬 음원 분리 실패'
            return jsonify({
                'message': error_msg,
                'error': str(e)
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


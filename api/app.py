from flask import Flask, jsonify, request
from flask_cors import CORS
from minio.error import S3Error
import os

from config import (
    ORIGINAL_BUCKET,
    MAX_FILE_SIZE_MB
)
from validators import validate_uploaded_file
from services import save_uploaded_file
from storage import setup_storage
from job_queue import init_queue, create_job, get_job_status

app = Flask(__name__)
CORS(app)

# Flask 설정
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE_MB * 1024 * 1024

# MinIO 클라이언트 초기화 (버킷 설정 포함)
minio_client = setup_storage()

# 대기열 초기화
init_queue(minio_client)


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
    """
    악보 변환 요청 (대기열에 추가)

    Returns:
        - 202 Accepted: 작업이 대기열에 추가됨 (job_id, position 포함)
        - 400/413/500: 에러 발생
    """
    # 1. 파일 유효성 검사
    file, error = validate_uploaded_file('music_file')
    if error:
        return file  # error가 있으면 file에 error response가 들어있음

    # 2. vocal_type 파라미터 받기 (기본값: female)
    vocal_type = request.form.get('vocal_type', 'female')

    # 3. 파일 저장
    try:
        file_info = save_uploaded_file(file, minio_client, ORIGINAL_BUCKET)

        # 4. 대기열에 작업 추가
        job_result = create_job(file_info, vocal_type)

        # 대기열 가득 참
        if job_result.get('error'):
            return jsonify(job_result), 503  # 503 Service Unavailable

        return jsonify(job_result), 202  # 202 Accepted

    except S3Error as e:
        return jsonify({
            'message': f'MinIO 저장 중 오류 발생: {str(e)}'
        }), 500

    except Exception as e:
        return jsonify({
            'message': f'파일 처리 중 오류 발생: {str(e)}'
        }), 500


@app.route('/jobs/<job_id>/status', methods=['GET'])
def get_status(job_id):
    """
    작업 상태 조회 (polling용)

    Returns:
        - 200: 상태 정보 (status, position/message/result)
        - 404: 존재하지 않는 작업
    """
    status = get_job_status(job_id)

    if status is None:
        return jsonify({
            'error': '존재하지 않는 작업입니다.'
        }), 404

    return jsonify(status), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

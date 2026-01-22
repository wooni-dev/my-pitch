from flask import jsonify, request
from utils import allowed_file
from config import ALLOWED_EXTENSIONS


def validate_uploaded_file(file_key='music_file'):
    """
    업로드된 파일의 유효성을 검사
    
    Args:
        file_key: request.files에서 찾을 파일 키
    
    Returns:
        tuple: (file_object, error_response)
            - 유효성 검사 통과: (file, None)
            - 유효성 검사 실패: (error_response, error_code)
    """
    # 파일 존재 확인
    if file_key not in request.files:
        return (jsonify({
            'message': '음악 파일이 없습니다',
        }), 400), True
    
    file = request.files[file_key]
    
    # 파일명 확인
    if file.filename == '':
        return (jsonify({
            'message': '파일이 선택되지 않았습니다',
        }), 400), True
    
    # 파일 형식 확인
    if not allowed_file(file.filename, ALLOWED_EXTENSIONS):
        allowed_formats = ', '.join(sorted(ALLOWED_EXTENSIONS)).upper()
        return (jsonify({
            'message': f'지원하지 않는 파일 형식입니다. 지원 형식: {allowed_formats}',
        }), 400), True
    
    # 유효성 검사 통과
    return file, None


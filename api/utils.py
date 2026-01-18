import librosa
import numpy as np


def allowed_file(filename, allowed_extensions):
    """
    파일 확장자가 허용된 형식인지 확인
    
    Args:
        filename: 파일명
        allowed_extensions: 허용된 확장자 set (예: {'mp3', 'wav'})
    
    Returns:
        bool: 허용된 확장자면 True, 아니면 False
    """
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions


def extract_pitch_info(vocal_file_path: str):
    """
    오디오 파일에서 음정 정보를 추출
    
    Args:
        vocal_file_path: 분석할 오디오 파일 경로
    
    Returns:
        list: 음정 정보 리스트 [{"note": "C4", "start_time": 0.5, "duration": 1.2, "end_time": 1.7}, ...]
    """
    # 오디오 파일 로드
    y, sr = librosa.load(vocal_file_path, sr=None)

    # 피치 추출 (pyin 알고리즘 사용)
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        fmin=librosa.note_to_hz('C2'),  # 최소 주파수 (C2 = 약 65Hz)
        fmax=librosa.note_to_hz('C7'),  # 최대 주파수 (C7 = 약 2093Hz)
        sr=sr
    )

    # 프레임을 시간으로 변환
    times = librosa.frames_to_time(range(len(f0)), sr=sr)

    # 음정 정보를 담을 리스트
    notes_data = []

    # 현재 처리 중인 노트 정보
    current_note = None
    current_start_time = None

    for i, (frequency, time) in enumerate(zip(f0, times)):
        # 피치가 감지되지 않은 경우 (묵음 또는 노이즈)
        if (np.isnan(frequency) or
            voiced_flag[i] == False or
            voiced_probs[i] < 0.1):

            # 이전에 처리 중이던 노트가 있다면 저장
            if current_note is not None:
                notes_data.append({
                    "note": current_note,
                    "start_time": round(current_start_time, 3),
                    "duration": round(time - current_start_time, 3),
                    "end_time": round(time, 3)
                })
                current_note = None
                current_start_time = None
            continue

        # 주파수를 음표 표기법으로 변환 (예: C4, D#4)
        note_name = librosa.hz_to_note(frequency)

        # 새로운 노트 시작
        if current_note is None:
            current_note = note_name
            current_start_time = time
        # 같은 노트가 계속되는 경우
        elif current_note == note_name:
            continue
        # 다른 노트로 변경된 경우
        else:
            # 이전 노트 저장
            notes_data.append({
                "note": current_note,
                "start_time": round(current_start_time, 3),
                "duration": round(time - current_start_time, 3),
                "end_time": round(time, 3)
            })
            # 새 노트 시작
            current_note = note_name
            current_start_time = time

    # 마지막 노트 처리
    if current_note is not None:
        final_time = times[-1]
        notes_data.append({
            "note": current_note,
            "start_time": round(current_start_time, 3),
            "duration": round(final_time - current_start_time, 3),
            "end_time": round(final_time, 3)
        })

    # 너무 짧은 노트 필터링 (0.1초 미만)
    notes_data = [note for note in notes_data if note["duration"] >= 0.1]

    return notes_data


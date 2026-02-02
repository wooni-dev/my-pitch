FROM python:3.11.9-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 패키지 설치
# ffmpeg는 demucs와 librosa가 오디오 처리에 필요
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt 복사 및 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# Flask 기본 포트
EXPOSE 5000

# Flask 애플리케이션 실행
CMD ["python", "app.py"]


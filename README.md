# my-pitch

음악 파일 업로드 및 분석 서비스

## 기술 스택

- **Frontend**: Next.js (React, TypeScript)
- **Backend**: Flask (Python)
- **File Storage**: MinIO (S3-compatible)
- **Web Server**: Nginx (Reverse Proxy)
- **Audio Processing**: librosa
- **Music Notation**: VexFlow

## 아키텍처

```
Browser
  ↓
Nginx (Port 80)
  ├── / → Next.js (Port 3000)
  └── /v1/ → Flask API (Port 5000)
         └── MinIO (Port 9000)
```

## 환경 설정

### 환경 변수 설정

1. `.env.example` 파일을 복사하여 `.env` 파일을 생성하세요:

```bash
cp .env.example .env
```

2. 필요한 값을 수정하세요 (특히 `ANALYSIS_SERVER_URL`)

### 설정 구조

`docker-compose.yml`에 모든 환경 변수가 명시되어 있으며, `.env` 파일에서 값을 오버라이드할 수 있습니다:

```yaml
# docker-compose.yml
environment:
  # .env에서 값 로드, 없으면 기본값 사용
  - MINIO_ENDPOINT=${MINIO_ENDPOINT:-fileserver:9000}
```

**장점:**
- ✅ `docker-compose.yml`만 보면 어떤 환경 변수가 사용되는지 즉시 파악
- ✅ `.env` 파일로 값 변경 가능 (프로덕션/개발 환경 분리)
- ✅ `.env` 파일 없이도 기본값으로 바로 실행 가능

## 실행 방법

### Docker 사용 (권장)

```bash
# 컨테이너 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 컨테이너 중지
docker-compose down
```

### 로컬 개발

```bash
# Backend (Flask)
cd api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py

# Frontend (Next.js)
cd client
npm install
npm run dev
```

## 접속 주소

- **Frontend**: http://localhost (Docker) 또는 http://localhost:3000 (로컬)
- **Backend API**: http://localhost:5000
- **MinIO Console**: http://localhost:9001

## API 엔드포인트

- `POST /v1/tracks/analyze` - 음악 파일 업로드 및 분석
  - 요청: `multipart/form-data` (music_file)
  - 응답: JSON (pitch_data, vocal_url, mr_url)

## 라이선스

이 프로젝트는 다음 오픈소스 라이브러리를 사용합니다:

- **minio** (Apache 2.0) - Object storage SDK
- **Flask** (BSD 3-Clause) - Web framework
- **librosa** (ISC) - Audio analysis
- **flask-cors** (MIT) - CORS support

자세한 내용은 [LICENSES.md](./LICENSES.md)를 참고하세요.
# my-pitch

음악 파일 업로드 및 분석 서비스

## 기술 스택

- **Backend**: Flask (Python)
- **File Storage**: MinIO (S3-compatible)
- **Web Server**: Nginx
- **Audio Processing**: librosa

## 실행 방법

```bash
docker-compose up -d
```

## API 엔드포인트

- `POST /v1/tracks/analyze` - 음악 파일 업로드 및 분석

## 라이선스

이 프로젝트는 다음 오픈소스 라이브러리를 사용합니다:

- **minio** (Apache 2.0) - Object storage SDK
- **Flask** (BSD 3-Clause) - Web framework
- **librosa** (ISC) - Audio analysis
- **flask-cors** (MIT) - CORS support

자세한 내용은 [LICENSES.md](./LICENSES.md)를 참고하세요.
# my-pitch

음악 파일 업로드 및 분석 서비스

## 개발 환경 설정 및 실행

### 1. hosts 파일 수정 (로컬 도메인 사용)

**Linux / macOS**
```bash
sudo nano /etc/hosts
```

**Windows**
```
관리자 권한으로 메모장 실행 → C:\Windows\System32\drivers\etc\hosts 열기
```

아래 내용 추가:
```
127.0.0.1 my-pitch api.my-pitch files.my-pitch files-admin.my-pitch
```

### 2. 개발 컨테이너 실행
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## 프로덕션(배포) 환경 설정 및 실행

### 1. SSL 인증서 생성 (최초 1회)

**scripts/generate-ssl-cert.sh 파일 편집** (이메일 주소 수정)

**Linux / macOS**
```bash
chmod +x scripts/generate-ssl-cert.sh
./scripts/generate-ssl-cert.sh
```

**Windows (Git Bash 또는 WSL)**
```bash
bash scripts/generate-ssl-cert.sh
```

자세한 내용은 [SSL_SETUP_GUIDE.md](./SSL_SETUP_GUIDE.md)를 참고하세요.

### 2. 프로덕션 컨테이너 실행
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 라이선스

이 프로젝트는 다음 오픈소스 라이브러리를 사용합니다:

- **minio** (Apache 2.0) - Object storage SDK
- **Flask** (BSD 3-Clause) - Web framework
- **librosa** (ISC) - Audio analysis
- **flask-cors** (MIT) - CORS support

자세한 내용은 [LICENSES.md](./LICENSES.md)를 참고하세요.
# Docker 실행 가이드

## 📋 프로젝트 구성

- **Nginx**: 웹 서버 (포트 80, 443)
- **API**: Flask API 서버 (포트 5000)
- **Fileserver**: MinIO 파일 저장소 (포트 9000, 9001)

## 🚀 빠른 시작

### 0. 환경 설정 (최초 1회)

환경 변수 파일을 설정합니다:

```bash
# .env.example을 복사하여 .env 생성
cp .env.example .env

# .env 파일을 열어서 필요한 값 수정
# 특히 MinIO 계정 정보는 반드시 변경하세요!
```

**`.env` 파일 예시:**
```env
# MinIO 파일서버 설정
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=your-secure-password-here
```

> ⚠️ **보안 주의**: 프로덕션 환경에서는 반드시 강력한 비밀번호로 변경하세요!

### 1. 컨테이너 실행

```bash
docker-compose up -d
```

- `-d`: 백그라운드 실행
- 처음 실행 시 이미지 빌드가 진행됩니다 (1-2분 소요)

### 2. 확인

```bash
# 컨테이너 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f
```

### 3. 접속

- **Nginx**: http://localhost
- **API**: http://localhost:5000
- **MinIO Console**: http://localhost:9001 (웹 UI)
- **MinIO API**: http://localhost:9000

**MinIO 로그인 정보:**
- Username: `.env` 파일의 `MINIO_ROOT_USER`
- Password: `.env` 파일의 `MINIO_ROOT_PASSWORD`

## 🔧 주요 명령어

### 컨테이너 관리

```bash
# 중지
docker-compose stop

# 시작 (이미 생성된 컨테이너)
docker-compose start

# 재시작
docker-compose restart

# 완전 삭제
docker-compose down
```

### 로그 확인

```bash
# 전체 로그
docker-compose logs

# 특정 서비스 로그
docker-compose logs nginx
docker-compose logs api
docker-compose logs fileserver

# 실시간 로그 (follow)
docker-compose logs -f api

# 여러 서비스 동시 확인
docker-compose logs -f api fileserver
```

### 재빌드

```bash
# API 이미지만 재빌드
docker-compose up -d --build api

# 전체 재빌드
docker-compose up -d --build
```

## 🐍 API 개발

### 코드 수정

`api/app.py` 파일을 수정하면 자동으로 반영됩니다 (Flask debug 모드)

```python
# api/app.py 수정 → 저장
# 자동 재시작됨! (로그에서 확인 가능)
```

### 패키지 추가

1. `api/requirements.txt`에 패키지 추가
2. 컨테이너 재빌드

```bash
# requirements.txt 수정 후
docker-compose up -d --build api
```

### 컨테이너 내부 접속

```bash
# API 컨테이너 접속
docker-compose exec api bash

# Python 실행
docker-compose exec api python

# 스크립트 실행
docker-compose exec api python your_script.py
```

## 📦 MinIO 파일서버 사용

### 웹 콘솔 접속

1. 브라우저에서 http://localhost:9001 접속
2. `.env` 파일의 계정 정보로 로그인
3. 버킷(Bucket) 생성 및 파일 업로드

### 버킷 생성

웹 콘솔 또는 mc 클라이언트로 버킷 생성:

```bash
# MinIO 컨테이너 내부에서
docker-compose exec fileserver mc alias set myminio http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
docker-compose exec fileserver mc mb myminio/my-bucket
docker-compose exec fileserver mc ls myminio
```

### Python에서 MinIO 사용

```python
# api/app.py 예시
from minio import Minio

client = Minio(
    "fileserver:9000",  # Docker 네트워크 내부에서는 서비스명 사용
    access_key="admin",  # 환경 변수로 관리 권장
    secret_key="admin12345",
    secure=False
)

# 버킷 목록 확인
buckets = client.list_buckets()
```

### 파일 업로드/다운로드 테스트

```bash
# 파일 업로드 (웹 콘솔 또는 API 사용)
curl -X PUT http://localhost:9000/my-bucket/test.txt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --data-binary "@test.txt"
```

## 🔍 문제 해결

### 포트 충돌

```bash
# Windows에서 포트 사용 확인
netstat -ano | findstr :80
netstat -ano | findstr :5000
netstat -ano | findstr :9000
netstat -ano | findstr :9001

# Linux/Mac에서 포트 사용 확인
lsof -i :80
lsof -i :5000

# docker-compose.yml에서 포트 변경
ports:
  - "8080:80"  # 80 → 8080으로 변경
  - "5001:5000"  # 5000 → 5001로 변경
  - "9002:9000"  # 9000 → 9002로 변경
```

### 컨테이너가 시작되지 않을 때

```bash
# 로그에서 에러 확인
docker-compose logs

# 설정 검증
docker-compose config

# 완전 재시작
docker-compose down
docker-compose up -d
```

### 변경사항이 반영 안 될 때

```bash
# 강제 재생성
docker-compose up -d --force-recreate

# 캐시 없이 재빌드
docker-compose build --no-cache api
docker-compose up -d

# 특정 서비스만 재시작
docker-compose restart api
docker-compose restart fileserver
```

### MinIO 데이터 초기화

```bash
# MinIO 데이터 완전 삭제 (주의!)
docker-compose down
rm -rf fileserver/data/*  # Linux/Mac
# 또는
# rmdir /s fileserver\data  # Windows (관리자 권한 필요)

# 재시작
docker-compose up -d
```

### 전체 환경 초기화

```bash
# 컨테이너, 네트워크, 볼륨 모두 삭제
docker-compose down -v

# 이미지까지 삭제
docker-compose down -v --rmi all

# 완전히 새로 시작
docker-compose up -d --build
```

## 📁 프로젝트 구조

```
my-pitch/
├── docker-compose.yml      # Docker Compose 설정
├── .dockerignore           # Docker 제외 파일
├── .gitignore             # Git 제외 파일
├── .env                   # 환경 변수 (Git 제외)
├── .env.example           # 환경 변수 예시 (Git 포함)
├── DOCKER_GUIDE.md        # Docker 사용 가이드
├── nginx/
│   ├── html/              # 정적 파일 (index.html 등)
│   └── conf.d/            # Nginx 설정 (default.conf)
├── api/
│   ├── Dockerfile         # Python 이미지 설정
│   ├── requirements.txt   # Python 패키지
│   ├── app.py            # Flask 애플리케이션
│   └── venv/             # 로컬 가상환경 (Docker에서 제외됨)
└── fileserver/
    └── data/             # MinIO 데이터 저장소 (볼륨 마운트)
        └── .gitkeep      # Git에서 디렉토리 유지용
```

## 💡 개발 워크플로우

### 일반적인 개발 흐름

1. **환경 설정 (최초 1회)**
   ```bash
   cp .env.example .env
   # .env 파일 수정
   ```

2. **Docker 시작**
   ```bash
   docker-compose up -d
   ```

3. **서비스 확인**
   ```bash
   # 컨테이너 상태
   docker-compose ps
   
   # 각 서비스 접속 테스트
   curl http://localhost            # Nginx
   curl http://localhost:5000       # API
   # http://localhost:9001 브라우저 접속  # MinIO
   ```

4. **코드 수정**
   - `api/app.py` 수정
   - 저장하면 자동 재시작

5. **테스트**
   ```bash
   curl http://localhost:5000
   ```

6. **로그 확인**
   ```bash
   docker-compose logs -f api
   ```

7. **작업 종료**
   ```bash
   docker-compose stop
   ```

### 패키지 추가 시

1. `api/requirements.txt` 수정
2. 재빌드
   ```bash
   docker-compose up -d --build api
   ```
3. 확인
   ```bash
   docker-compose exec api pip list
   ```

## 🌐 API 엔드포인트

현재 구현된 엔드포인트:

- `GET /` - Hello World
- `GET /health` - 헬스 체크 (존재하는 경우)

테스트:
```bash
curl http://localhost:5000/
curl http://localhost:5000/health
```

## 🔗 Docker 네트워크

모든 서비스는 `my-pitch-network`라는 브릿지 네트워크에 연결되어 있습니다.

### 서비스 간 통신

컨테이너 내부에서는 **서비스 이름**으로 다른 서비스에 접근할 수 있습니다:

```python
# API 컨테이너에서 다른 서비스 접근
import requests

# Nginx 접근
response = requests.get('http://nginx')

# MinIO 접근
response = requests.get('http://fileserver:9000')
```

### 네트워크 디버깅

```bash
# 네트워크 정보 확인
docker network inspect my-pitch_my-pitch-network

# 특정 컨테이너의 네트워크 설정 확인
docker inspect my-pitch-api

# 컨테이너 내부에서 다른 서비스 ping 테스트
docker-compose exec api ping fileserver
docker-compose exec api ping nginx
```

## 📊 성능 모니터링

### 리소스 사용량 확인

```bash
# 모든 컨테이너의 실시간 리소스 사용량
docker stats

# 특정 컨테이너만 확인
docker stats my-pitch-api my-pitch-fileserver

# 한 번만 확인 (실시간 아님)
docker stats --no-stream
```

### 디스크 사용량

```bash
# Docker가 사용하는 전체 디스크 공간
docker system df

# 상세 정보
docker system df -v

# MinIO 데이터 크기 확인
du -sh fileserver/data/  # Linux/Mac
```

### 컨테이너 상태 확인

```bash
# 컨테이너 상세 정보
docker-compose ps -a

# 특정 컨테이너 상세 정보
docker inspect my-pitch-api

# 컨테이너 프로세스 확인
docker-compose top
docker-compose top api
```

### 불필요한 리소스 정리

```bash
# 사용하지 않는 이미지/컨테이너 정리
docker system prune

# 볼륨까지 정리 (주의!)
docker system prune -a --volumes

# 빌드 캐시만 정리
docker builder prune
```

## 💾 데이터 백업 및 복원

### MinIO 데이터 백업

```bash
# fileserver/data 디렉토리 전체 백업
tar -czf minio-backup-$(date +%Y%m%d).tar.gz fileserver/data/

# 또는 특정 버킷만 백업 (MinIO Client 사용)
docker-compose exec fileserver mc mirror myminio/my-bucket /backup/my-bucket
```

### 데이터 복원

```bash
# 백업 파일 압축 해제
tar -xzf minio-backup-20260117.tar.gz

# Docker 재시작하면 자동으로 데이터 로드됨
docker-compose restart fileserver
```

### 데이터베이스 마이그레이션 (향후 추가 시)

```bash
# 컨테이너 내부에서 마이그레이션 실행
docker-compose exec api python migrate.py
docker-compose exec api flask db upgrade
```

## 🔐 보안 권장사항

1. **환경 변수 관리**
   - `.env` 파일은 절대 Git에 커밋하지 마세요
   - 프로덕션 환경에서는 강력한 비밀번호 사용
   
2. **MinIO 보안**
   - 기본 계정(`admin`/`admin12345`)은 개발용입니다
   - 프로덕션에서는 반드시 변경하세요
   - 필요시 HTTPS 설정 추가

3. **포트 노출**
   - 프로덕션에서는 필요한 포트만 외부에 노출
   - 내부 통신은 Docker 네트워크 사용

## 🎯 명령어 치트시트

### 자주 사용하는 명령어

```bash
# 🚀 시작
docker-compose up -d                    # 백그라운드 실행
docker-compose up -d --build            # 재빌드 후 실행

# 🛑 중지/제거
docker-compose stop                     # 중지
docker-compose down                     # 중지 + 삭제
docker-compose down -v                  # 중지 + 삭제 + 볼륨 삭제

# 📋 상태 확인
docker-compose ps                       # 컨테이너 목록
docker-compose logs -f                  # 전체 로그
docker-compose logs -f api              # 특정 서비스 로그
docker stats                            # 리소스 사용량

# 🔧 재시작
docker-compose restart                  # 전체 재시작
docker-compose restart api              # 특정 서비스만
docker-compose up -d --force-recreate   # 강제 재생성

# 💻 컨테이너 접속
docker-compose exec api bash            # API 컨테이너 접속
docker-compose exec api python          # Python 실행
docker-compose exec fileserver sh       # MinIO 컨테이너 접속

# 🔍 디버깅
docker-compose config                   # 설정 검증
docker inspect my-pitch-api             # 상세 정보
docker-compose top                      # 프로세스 확인
```

## ❓ FAQ

### Q: .env 파일을 수정했는데 반영이 안 돼요
```bash
# 컨테이너를 재생성해야 환경 변수가 반영됩니다
docker-compose down
docker-compose up -d
```

### Q: api/app.py 수정이 반영되지 않아요
```bash
# Flask debug 모드가 켜져있는지 확인
docker-compose logs api

# 안 된다면 컨테이너 재시작
docker-compose restart api
```

### Q: MinIO에 접속이 안 돼요
```bash
# 1. 컨테이너가 실행 중인지 확인
docker-compose ps

# 2. 로그 확인
docker-compose logs fileserver

# 3. .env 파일의 계정 정보 확인
cat .env

# 4. 브라우저 캐시 삭제 후 재시도
```

### Q: 포트 충돌이 발생해요
```bash
# 사용 중인 포트 확인
netstat -ano | findstr :80    # Windows
lsof -i :80                   # Linux/Mac

# docker-compose.yml에서 포트 변경
# ports:
#   - "8080:80"  # 다른 포트로 변경
```

### Q: 디스크 용량이 부족해요
```bash
# Docker가 사용하는 공간 확인
docker system df

# 불필요한 리소스 정리
docker system prune -a

# MinIO 데이터 확인 및 정리
du -sh fileserver/data/
```

### Q: 컨테이너가 계속 재시작돼요
```bash
# 에러 로그 확인
docker-compose logs --tail=100 api

# 컨테이너 상태 확인
docker-compose ps

# 일반적인 원인:
# - 포트 충돌
# - 환경 변수 오류
# - 패키지 설치 실패
```

## 📚 참고 문서

- [Docker Compose 공식 문서](https://docs.docker.com/compose/)
- [Flask 공식 문서](https://flask.palletsprojects.com/)
- [Nginx 공식 문서](https://nginx.org/en/docs/)
- [MinIO 공식 문서](https://min.io/docs/minio/linux/index.html)
- [MinIO Python SDK](https://min.io/docs/minio/linux/developers/python/minio-py.html)

---

**💡 팁**: 문제가 발생하면 먼저 `docker-compose logs`로 로그를 확인하세요!


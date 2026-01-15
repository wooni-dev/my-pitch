# Docker 실행 가이드

## 📋 프로젝트 구성

- **Nginx**: 웹 서버 (포트 80, 443)
- **API**: Flask API 서버 (포트 5000)

## 🚀 빠른 시작

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

# 실시간 로그 (follow)
docker-compose logs -f api
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

## 🔍 문제 해결

### 포트 충돌

```bash
# Windows에서 포트 사용 확인
netstat -ano | findstr :80
netstat -ano | findstr :5000

# docker-compose.yml에서 포트 변경
ports:
  - "8080:80"  # 80 → 8080으로 변경
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
```

## 📁 프로젝트 구조

```
my-pitch/
├── docker-compose.yml    # Docker Compose 설정
├── .dockerignore         # Docker 제외 파일
├── nginx/
│   ├── html/            # 정적 파일
│   └── conf.d/          # Nginx 설정
└── api/
    ├── Dockerfile       # Python 이미지 설정
    ├── requirements.txt # Python 패키지
    ├── app.py          # Flask 애플리케이션
    └── venv/           # 로컬 가상환경 (Docker에서 제외됨)
```

## 💡 개발 워크플로우

### 일반적인 개발 흐름

1. **Docker 시작**
   ```bash
   docker-compose up -d
   ```

2. **코드 수정**
   - `api/app.py` 수정
   - 저장하면 자동 재시작

3. **테스트**
   ```bash
   curl http://localhost:5000
   ```

4. **로그 확인**
   ```bash
   docker-compose logs -f api
   ```

5. **작업 종료**
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

## 📚 참고

- [Docker Compose 문서](https://docs.docker.com/compose/)
- [Flask 문서](https://flask.palletsprojects.com/)
- [Nginx 문서](https://nginx.org/en/docs/)


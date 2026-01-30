# Docker 실행 가이드

## 📋 목차
- [개발 환경 실행](#개발-환경-실행)
- [프로덕션 환경 실행](#프로덕션-환경-실행)
- [컨테이너 관리](#컨테이너-관리)
- [로그 확인](#로그-확인)
- [개별 서비스 관리](#개별-서비스-관리)
- [빌드 및 재시작](#빌드-및-재시작)
- [데이터 정리](#데이터-정리)

---

## 개발 환경 실행

### 기본 실행 (포그라운드)
```bash
docker-compose up
```

### 백그라운드 실행
```bash
docker-compose up -d
```

### 빌드 후 실행
```bash
docker-compose up --build
```

### 특정 서비스만 실행
```bash
# 예: API 서버만 실행
docker-compose up api

# 예: 클라이언트와 API만 실행
docker-compose up client api
```

---

## 프로덕션 환경 실행

### 기본 실행 (포그라운드)
```bash
docker-compose -f docker-compose.prod.yml up
```

### 백그라운드 실행
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 빌드 후 실행
```bash
docker-compose -f docker-compose.prod.yml up --build
```

---

## 컨테이너 관리

### 컨테이너 중지
```bash
# 개발 환경
docker-compose down

# 프로덕션 환경
docker-compose -f docker-compose.prod.yml down
```

### 컨테이너 중지 (볼륨 포함 삭제)
```bash
# 개발 환경
docker-compose down -v

# 프로덕션 환경
docker-compose -f docker-compose.prod.yml down -v
```

### 컨테이너 재시작
```bash
# 개발 환경
docker-compose restart

# 프로덕션 환경
docker-compose -f docker-compose.prod.yml restart

# 특정 서비스만 재시작
docker-compose restart api
```

### 실행 중인 컨테이너 확인
```bash
docker-compose ps
```

---

## 로그 확인

### 전체 로그 확인
```bash
# 개발 환경
docker-compose logs

# 프로덕션 환경
docker-compose -f docker-compose.prod.yml logs
```

### 실시간 로그 모니터링
```bash
# 개발 환경
docker-compose logs -f

# 특정 서비스 로그만 실시간 확인
docker-compose logs -f api
docker-compose logs -f client
```

### 최근 N줄의 로그만 확인
```bash
# 최근 100줄
docker-compose logs --tail=100

# 최근 100줄 + 실시간 모니터링
docker-compose logs -f --tail=100
```

---

## 개별 서비스 관리

### 서비스 시작/중지
```bash
# 서비스 시작
docker-compose start api
docker-compose start client
docker-compose start fileserver
docker-compose start nginx

# 서비스 중지
docker-compose stop api
docker-compose stop client
```

### 컨테이너 내부 접속
```bash
# API 컨테이너
docker exec -it my-pitch-api bash

# Client 컨테이너
docker exec -it my-pitch-client sh

# FileServer (MinIO)
docker exec -it my-pitch-fileserver sh

# Nginx
docker exec -it my-pitch-nginx sh
```

---

## 빌드 및 재시작

### 이미지 빌드만 실행
```bash
# 개발 환경
docker-compose build

# 프로덕션 환경
docker-compose -f docker-compose.prod.yml build

# 특정 서비스만 빌드
docker-compose build api
```

### 캐시 없이 빌드
```bash
docker-compose build --no-cache
```

### 빌드 후 재시작
```bash
# 개발 환경
docker-compose up -d --build

# 프로덕션 환경
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## 데이터 정리

### 중지된 컨테이너 삭제
```bash
docker container prune
```

### 사용하지 않는 이미지 삭제
```bash
docker image prune

# 모든 미사용 이미지 삭제
docker image prune -a
```

### 사용하지 않는 볼륨 삭제
```bash
docker volume prune
```

### 전체 정리 (컨테이너, 네트워크, 이미지, 캐시)
```bash
docker system prune

# 볼륨 포함 전체 정리
docker system prune -a --volumes
```

### 프로젝트 관련 모든 리소스 삭제
```bash
# 개발 환경
docker-compose down -v --rmi all

# 프로덕션 환경
docker-compose -f docker-compose.prod.yml down -v --rmi all
```

---

## 🔍 서비스 접속 정보

### 개발 환경
- **클라이언트**: http://localhost:3000
- **API 서버**: http://localhost:5000
- **MinIO API**: http://localhost:9000
- **MinIO 웹 UI**: http://localhost:9001
- **Nginx**: http://localhost:80

### 프로덕션 환경
- **Nginx 프록시**: http://localhost:80
- 서비스별 포트는 Nginx를 통해 라우팅됩니다.

---

## 💡 유용한 팁

### 환경 변수 설정
프로젝트 루트에 `.env` 파일을 생성하여 환경 변수를 설정할 수 있습니다:

```env
# MinIO 설정
MINIO_ROOT_USER=your_username
MINIO_ROOT_PASSWORD=your_password

# API URL
NEXT_PUBLIC_API_URL=http://localhost:5000

# 파일 업로드 제한
MAX_FILE_SIZE_MB=10
```

### 디스크 사용량 확인
```bash
# Docker 전체 디스크 사용량
docker system df

# 상세 정보
docker system df -v
```

### 네트워크 확인
```bash
# 네트워크 목록
docker network ls

# 특정 네트워크 상세 정보
docker network inspect my-pitch-network
```


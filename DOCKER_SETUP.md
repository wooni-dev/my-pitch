# Docker Compose 실행 가이드

Docker Compose를 사용한 Nginx 웹 서버 프로젝트입니다.

## 📋 요구사항

- Docker
- Docker Compose

## 🚀 시작하기

### 1. 컨테이너 실행

```bash
docker-compose up -d
```

- `-d` 옵션: 백그라운드에서 실행

### 2. 컨테이너 상태 확인

```bash
docker-compose ps
```

### 3. 로그 확인

```bash
# 전체 로그 확인
docker-compose logs

# nginx 로그만 확인
docker-compose logs nginx

# 실시간 로그 확인 (follow)
docker-compose logs -f nginx
```

### 4. 웹 브라우저에서 확인

```
http://localhost
```

### 5. 컨테이너 중지

```bash
# 중지만 (컨테이너는 유지)
docker-compose stop

# 중지 및 제거
docker-compose down
```

### 6. 컨테이너 재시작

```bash
docker-compose restart
```

## 📁 프로젝트 구조

```
my-pitch/
├── docker-compose.yml          # Docker Compose 설정
├── nginx/
│   ├── html/
│   │   └── index.html         # 웹 페이지
│   └── conf.d/
│       └── default.conf       # Nginx 설정
└── .dockerignore              # Docker 제외 파일 목록
```

## ⚙️ 설정 수정

### HTML 파일 수정

`nginx/html/` 디렉토리의 파일을 수정하면 즉시 반영됩니다.

```bash
# 수정 후 브라우저 새로고침만 하면 됨
```

### Nginx 설정 수정

`nginx/conf.d/default.conf` 파일을 수정한 후:

```bash
# nginx 재로드
docker-compose exec nginx nginx -s reload

# 또는 컨테이너 재시작
docker-compose restart nginx
```

### 설정 검증

```bash
# Nginx 설정 문법 확인
docker-compose exec nginx nginx -t
```

### 커스텀 도메인 사용 (hosts 파일 설정)

Nginx의 `server_name`을 `my-pitch`로 설정한 경우, 브라우저에서 `http://my-pitch`로 접근하려면 운영체제의 hosts 파일을 수정해야 합니다.

#### Windows

관리자 권한으로 실행:

```bash
notepad C:\Windows\System32\drivers\etc\hosts
```

파일 끝에 추가:

```
127.0.0.1    my-pitch
```

#### macOS / Linux

터미널에서 실행:

```bash
sudo nano /etc/hosts
```

파일 끝에 추가:

```
127.0.0.1    my-pitch
```

저장 후 (`Ctrl+O`, `Enter`, `Ctrl+X`), 컨테이너를 재시작하면 `http://my-pitch`로 접근 가능합니다.

## 🔧 유용한 명령어

### 컨테이너 내부 접속

```bash
docker-compose exec nginx bash
```

### 포트 변경

`docker-compose.yml` 파일의 `ports` 섹션 수정:

```yaml
ports:
  - "8080:80"  # 호스트:컨테이너
```

수정 후:

```bash
docker-compose down
docker-compose up -d
```

### 볼륨 확인

```bash
docker-compose exec nginx ls -la /usr/share/nginx/html
```

## 🐛 문제 해결

### 포트 충돌 오류

```bash
# 80번 포트를 사용 중인 프로세스 확인 (Windows)
netstat -ano | findstr :80

# 해결방법: docker-compose.yml에서 다른 포트로 변경
```

### 컨테이너가 시작되지 않을 때

```bash
# 로그 확인
docker-compose logs nginx

# 설정 파일 검증
docker-compose config
```

### 변경사항이 반영되지 않을 때

```bash
# 컨테이너 재생성
docker-compose up -d --force-recreate

# 또는 완전히 제거 후 재시작
docker-compose down
docker-compose up -d
```

## 📝 Nginx 설정 특징

- ✅ gzip 압축 활성화 (텍스트 파일 압축)
- ✅ 정적 파일 1년 캐싱
- ✅ SPA(Single Page Application) 지원 (try_files)
- ✅ IPv4/IPv6 지원
- ✅ 자동 재시작 (unless-stopped)

## 📚 참고 자료

- [Docker Compose 공식 문서](https://docs.docker.com/compose/)
- [Nginx 공식 문서](https://nginx.org/en/docs/)


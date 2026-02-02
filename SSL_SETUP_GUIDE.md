# Let's Encrypt SSL 인증서 설정 가이드

## 준비사항

1. **도메인 DNS 설정 완료**
   - `my-pitch.work` → 서버 IP
   - `api.my-pitch.work` → 서버 IP
   - `files.my-pitch.work` → 서버 IP

2. **포트 개방**
   - 80 포트 (HTTP)
   - 443 포트 (HTTPS)

## SSL 인증서 발급 방법

### 자동 설치 (추천)

```bash
# 1. 스크립트에 실행 권한 부여
chmod +x scripts/generate-ssl-cert.sh

# 2. 스크립트 편집 - 이메일 주소 수정
# scripts/generate-ssl-cert.sh 파일을 열어서 다음 라인 수정:
# email="your-email@example.com"  → 실제 이메일 주소로 변경

# 3. 스크립트 실행
./scripts/generate-ssl-cert.sh
```

### 수동 설치 (고급)

자동 스크립트를 사용하지 않고 직접 제어하려면:

```bash
# 1. 챌린지 컨테이너 시작
docker compose -f docker-compose.cert-generation.yml up -d nginx-challenge

# 2. 인증서 발급
docker compose -f docker-compose.cert-generation.yml run --rm --entrypoint certbot certbot-init certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d my-pitch.work

# 3. 챌린지 컨테이너 정리
docker compose -f docker-compose.cert-generation.yml down

# 4. 운영 서비스 시작
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 인증서 갱신

인증서는 **자동으로 갱신**됩니다. certbot 컨테이너가 12시간마다 갱신을 확인합니다.

수동으로 갱신하려면:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload
```

## 테스트 모드

실제 발급 전에 테스트하려면 `scripts/generate-ssl-cert.sh`에서:
```bash
staging=1  # 테스트 모드
```

## 문제 해결

### 인증서 발급 실패
1. DNS 설정 확인 (도메인이 서버 IP를 올바르게 가리키는지)
2. 방화벽에서 80, 443 포트 개방 확인
3. 이미 5개 이상의 인증서 발급 시도 시 1시간 대기 후 재시도

### 인증서 삭제 후 재발급
```bash
rm -rf certbot/conf/live
rm -rf certbot/conf/archive
rm -rf certbot/conf/renewal
./scripts/generate-ssl-cert.sh
```

### HTTPS 접속 안됨
```bash
# Nginx 로그 확인
docker logs my-pitch-nginx

# 인증서 파일 확인
ls -la certbot/conf/live/
```

## 파일 구조

```
my-pitch/
├── certbot/
│   ├── conf/              # 인증서 저장 위치
│   │   ├── live/
│   │   │   ├── my-pitch.work/
│   │   │   ├── api.my-pitch.work/
│   │   │   └── files.my-pitch.work/
│   │   └── renewal/       # 자동 갱신 설정
│   └── www/               # Let's Encrypt 챌린지용
├── nginx/
│   └── conf.d/
│       ├── nginx.cert-challenge.conf  # 인증서 챌린지
│       ├── nginx.dev.conf         # 개발 환경 설정
│       └── nginx.prod.conf        # 운영 환경 설정 (HTTPS)
├── docker-compose.yml             # 공통 베이스 설정
├── docker-compose.dev.yml         # 개발 환경
├── docker-compose.prod.yml        # 프로덕션 환경
├── docker-compose.cert-generation.yml  # 인증서 생성
├── nginx/
│   └── scripts/
│       └── entrypoint.sh          # Nginx SSL 자동 갱신 스크립트
└── scripts/
    └── generate-ssl-cert.sh       # SSL 인증서 초기 발급 스크립트
```

## 변경된 환경변수

HTTPS 적용 후에는 다음 환경변수를 HTTPS로 변경해야 합니다:

```bash
# .env 파일
NEXT_PUBLIC_API_URL=https://api.my-pitch.work
MINIO_PUBLIC_ENDPOINT=https://files.my-pitch.work
```

클라이언트를 다시 빌드해야 합니다:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build client
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d client
```


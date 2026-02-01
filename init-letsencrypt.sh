#!/bin/bash

# Let's Encrypt SSL 인증서 초기 발급 스크립트
# 사용법: ./init-letsencrypt.sh

# 에러 발생 시 스크립트 즉시 중단 (안전장치)
set -e

# ========================================
# 설정 (필요에 따라 수정)
# ========================================
domains=(my-pitch.work api.my-pitch.work files.my-pitch.work)  # 인증서를 발급할 도메인 목록
email="wooni.dev@gmail.com"  # Let's Encrypt 알림용 이메일 (인증서 만료 알림 등)
staging=0  # 테스트용: 1, 실제 운영: 0 (staging은 발급 횟수 제한 없음)

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Let's Encrypt SSL 인증서 발급 시작 ===${NC}"

# 이메일 주소 확인
if [ "$email" = "your-email@example.com" ]; then
    echo -e "${RED}오류: 스크립트에서 이메일 주소를 설정해주세요!${NC}"
    exit 1
fi

# ========================================
# 필요한 디렉토리 생성
# ========================================
echo -e "${YELLOW}1. 필요한 디렉토리 생성...${NC}"
mkdir -p certbot/conf  # 인증서 저장 폴더
mkdir -p certbot/www   # 챌린지 파일(도메인 소유권 검증용) 폴더

# ========================================
# 기존 인증서 확인 및 처리
# ========================================
if [ -d "certbot/conf/live/${domains[0]}" ]; then
    echo -e "${YELLOW}기존 인증서가 존재합니다. 삭제하시겠습니까? (y/N)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "${YELLOW}기존 인증서 삭제 중...${NC}"
        rm -rf certbot/conf/live
        rm -rf certbot/conf/archive
        rm -rf certbot/conf/renewal
    else
        echo -e "${GREEN}기존 인증서를 유지합니다.${NC}"
        exit 0
    fi
fi

# ========================================
# Let's Encrypt 전용 임시 Nginx 설정 생성
# ========================================
echo -e "${YELLOW}2. Let's Encrypt 전용 임시 Nginx 설정 생성...${NC}"
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}오류: docker-compose.prod.yml 파일을 찾을 수 없습니다.${NC}"
    exit 1
fi

# 컨테이너가 실행 중이면 중지
if [ "$(docker ps -q -f name=my-pitch-nginx)" ]; then
    echo -e "${YELLOW}기존 컨테이너 중지...${NC}"
    docker compose -f docker-compose.prod.yml down
fi

# Let's Encrypt 인증서 발급 전용 임시 nginx 설정 파일 생성
cat > nginx/conf.d/certbot-temp.conf << 'EOF'
# Let's Encrypt 인증서 발급 전용 임시 설정
# upstream 없이 certbot의 acme-challenge만 처리

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Let's Encrypt 챌린지 경로
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 나머지 요청은 200 응답
    location / {
        return 200 "Let's Encrypt certification in progress...\n";
        add_header Content-Type text/plain;
    }
}
EOF

# HTTP 설정으로 임시 변경
echo -e "${YELLOW}3. HTTP 모드로 Nginx 시작...${NC}"
cp docker-compose.prod.yml docker-compose.prod.yml.backup  # 백업 생성
sed -i 's/production-https.conf/certbot-temp.conf/g' docker-compose.prod.yml  # 임시 설정으로 변경
sed -i 's/production-http.conf/certbot-temp.conf/g' docker-compose.prod.yml  # 임시 설정으로 변경

# nginx만 시작 (의존성 무시 - API/Client 없이 nginx만 실행)
docker compose -f docker-compose.prod.yml up -d --no-deps nginx

echo -e "${YELLOW}Nginx 시작 대기 중 (5초)...${NC}"
sleep 5

# ========================================
# Let's Encrypt 인증서 발급
# ========================================
echo -e "${YELLOW}4. Let's Encrypt 인증서 발급 중...${NC}"

# staging 모드 설정 (테스트용 - 발급 횟수 제한 없음)
staging_arg=""
if [ $staging != "0" ]; then
    staging_arg="--staging"
    echo -e "${YELLOW}테스트 모드로 실행 중...${NC}"
fi

# 각 도메인에 대해 인증서 발급
for domain in "${domains[@]}"; do
    echo -e "${GREEN}도메인 처리 중: $domain${NC}"
    
    # webroot 방식: nginx가 제공하는 폴더에 챌린지 파일 생성 → Let's Encrypt가 검증
    # --entrypoint certbot으로 기본 entrypoint 오버라이드
    # --force-renewal: 기존 인증서가 있어도 강제로 갱신
    docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        $staging_arg \
        --email $email \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d $domain
    
    # 발급 실패 시 원복 및 중단
    if [ $? -ne 0 ]; then
        echo -e "${RED}오류: $domain 인증서 발급 실패${NC}"
        echo -e "${YELLOW}원래 설정으로 복원 중...${NC}"
        mv docker-compose.prod.yml.backup docker-compose.prod.yml
        rm -f nginx/conf.d/certbot-temp.conf
        docker compose -f docker-compose.prod.yml down
        exit 1
    fi
done

# ========================================
# HTTPS 설정으로 전환 및 전체 서비스 시작
# ========================================
# HTTPS 설정으로 변경 (인증서 발급 완료되었으므로)
echo -e "${YELLOW}5. HTTPS 설정으로 변경...${NC}"
mv docker-compose.prod.yml.backup docker-compose.prod.yml  # 백업에서 원본 복원

# 임시 nginx 설정 파일 삭제
rm -f nginx/conf.d/certbot-temp.conf

# 전체 서비스 재시작 (이제 HTTPS로 동작)
echo -e "${YELLOW}6. 전체 서비스 재시작...${NC}"
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}=== SSL 인증서 발급 완료! ===${NC}"
echo -e "${GREEN}모든 도메인이 HTTPS로 서비스됩니다.${NC}"
echo -e "${YELLOW}인증서는 자동으로 갱신됩니다. (certbot 컨테이너가 90일마다 자동 처리)${NC}"



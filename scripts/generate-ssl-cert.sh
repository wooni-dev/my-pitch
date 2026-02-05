#!/bin/bash

# Let's Encrypt SSL 인증서 초기 발급 스크립트
# 사용법: ./scripts/generate-ssl-cert.sh

# 에러 발생 시 스크립트 즉시 중단 (안전장치)
set -e

# ========================================
# .env 파일 로드
# ========================================
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========================================
# 환경변수 검증
# ========================================
if [ -z "$SSL_DOMAINS" ]; then
    echo -e "${RED}오류: SSL_DOMAINS 환경변수가 설정되지 않았습니다.${NC}"
    echo -e "${YELLOW}.env 파일에 SSL_DOMAINS를 설정해주세요.${NC}"
    echo -e "${YELLOW}예: SSL_DOMAINS=\"my-pitch.work api.my-pitch.work files.my-pitch.work\"${NC}"
    exit 1
fi

if [ -z "$SSL_EMAIL" ]; then
    echo -e "${RED}오류: SSL_EMAIL 환경변수가 설정되지 않았습니다.${NC}"
    echo -e "${YELLOW}.env 파일에 SSL_EMAIL을 설정해주세요.${NC}"
    echo -e "${YELLOW}예: SSL_EMAIL=\"your-email@example.com\"${NC}"
    exit 1
fi

# ========================================
# 설정 (.env 환경변수 사용)
# ========================================
domains=($SSL_DOMAINS)  # 인증서를 발급할 도메인 목록
email="$SSL_EMAIL"  # Let's Encrypt 알림용 이메일 (인증서 만료 알림 등)
staging=0  # 테스트용: 1, 실제 운영: 0 (staging은 발급 횟수 제한 없음)

echo -e "${GREEN}=== Let's Encrypt SSL 인증서 발급 시작 ===${NC}"

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
echo -e "${YELLOW}2. Docker Compose 파일 확인...${NC}"
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}오류: docker-compose.yml 파일을 찾을 수 없습니다.${NC}"
    exit 1
fi

if [ ! -f "docker-compose.cert-generation.yml" ]; then
    echo -e "${RED}오류: docker-compose.cert-generation.yml 파일을 찾을 수 없습니다.${NC}"
    exit 1
fi

# 기존 운영 컨테이너가 실행 중이면 중지
if [ "$(docker ps -q -f name=my-pitch-nginx)" ]; then
    echo -e "${YELLOW}기존 컨테이너 중지...${NC}"
    docker compose down
fi

# 챌린지용 nginx 시작
echo -e "${YELLOW}3. 챌린지용 Nginx 시작 (docker-compose.cert-generation.yml)...${NC}"
docker compose -f docker-compose.cert-generation.yml up -d nginx-challenge

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
    
    # webroot 방식: nginx-challenge가 제공하는 폴더에 챌린지 파일 생성 → Let's Encrypt가 검증
    # --entrypoint certbot으로 기본 entrypoint 오버라이드
    # --force-renewal: 기존 인증서가 있어도 강제로 갱신
    docker compose -f docker-compose.cert-generation.yml run --rm --entrypoint certbot certbot-init certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        $staging_arg \
        --email $email \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d $domain
    
    # 발급 실패 시 정리 및 중단
    if [ $? -ne 0 ]; then
        echo -e "${RED}오류: $domain 인증서 발급 실패${NC}"
        echo -e "${YELLOW}챌린지 컨테이너 정리 중...${NC}"
        docker compose -f docker-compose.cert-generation.yml down
        exit 1
    fi
done

# ========================================
# 챌린지 컨테이너 정리
# ========================================
echo -e "${YELLOW}5. 챌린지 컨테이너 중지...${NC}"
docker compose -f docker-compose.cert-generation.yml down

echo -e "${GREEN}=== SSL 인증서 발급 완료! ===${NC}"
echo -e "${GREEN}인증서 위치: ./certbot/conf/live/도메인명/${NC}"
echo -e ""
echo -e "${YELLOW}다음 단계:${NC}"
echo -e "  개발 환경: ${GREEN}docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d${NC}"
echo -e "  운영 환경: ${GREEN}docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d${NC}"
echo -e ""
echo -e "${YELLOW}참고:${NC}"
echo -e "  - 인증서는 certbot 컨테이너가 자동으로 갱신합니다 (12시간마다 체크)"
echo -e "  - 모든 도메인이 HTTPS로 서비스됩니다"


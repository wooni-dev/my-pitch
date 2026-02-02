#!/bin/sh

# SSL 인증서 자동 갱신 스크립트
# 인증서 만료일을 체크하여 만료 30일 전 또는 만료된 경우 갱신합니다.

CERT_PATH="/etc/letsencrypt/live/my-pitch.work/cert.pem"
RENEWAL_THRESHOLD_DAYS=30

trap exit TERM

while :; do
    echo "[$(date)] Checking certificate expiration..."
    
    # 인증서 파일이 존재하는지 확인
    if [ -f "$CERT_PATH" ]; then
        # 인증서 만료일 가져오기 (UNIX timestamp)
        EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
        EXPIRY_TIMESTAMP=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY_DATE" +%s 2>/dev/null)
        
        # 현재 시간과 갱신 임계점 계산
        CURRENT_TIMESTAMP=$(date +%s)
        THRESHOLD_TIMESTAMP=$((CURRENT_TIMESTAMP + RENEWAL_THRESHOLD_DAYS * 86400))
        
        # 만료 예정이거나 이미 만료된 경우 갱신
        if [ "$EXPIRY_TIMESTAMP" -le "$THRESHOLD_TIMESTAMP" ]; then
            DAYS_REMAINING=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
            echo "[$(date)] Certificate expires in $DAYS_REMAINING days. Renewing..."
            
            # 인증서 갱신 및 nginx reload
            if certbot renew --quiet; then
                echo "[$(date)] Certificate renewed successfully. Reloading Nginx..."
                docker exec my-pitch-nginx nginx -s reload
            else
                echo "[$(date)] Certificate renewal failed!"
            fi
        else
            DAYS_REMAINING=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
            echo "[$(date)] Certificate is valid for $DAYS_REMAINING more days. No renewal needed."
        fi
    else
        echo "[$(date)] Certificate not found at $CERT_PATH. Skipping check."
    fi
    
    # 12시간마다 체크
    sleep 12h & wait ${!}
done


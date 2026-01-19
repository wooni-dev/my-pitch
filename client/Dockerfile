FROM node:20-alpine

WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci

# 애플리케이션 코드는 volumes로 마운트됨

# Next.js 기본 포트
EXPOSE 3000

# 개발 서버 실행
CMD ["npm", "run", "dev"]


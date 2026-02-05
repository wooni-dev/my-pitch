# MinIO Console SSH 터널링 가이드

프로덕션 환경에서 MinIO Web UI(Console)에 안전하게 접근하는 방법입니다.

## 왜 SSH 터널링인가?

MinIO Console(9001 포트)은 관리자 패널로, 외부에 직접 노출하면 보안 위험이 있습니다:

- 브루트포스 공격 대상
- 취약점 발견 시 즉시 공격 타겟
- 크레덴셜 유출 시 전체 데이터 노출

SSH 터널링을 사용하면 **필요할 때만** 안전하게 접근할 수 있습니다.

---

## 사전 준비

- PuTTY (Windows)
- SSH 개인 키 파일 (.ppk)

---

## 1단계: PuTTY 설정

1. PuTTY 실행
2. **Session**:
   - Host Name: 서버 도메인 또는 IP
   - Port: `22`
3. **Connection → Data**:
   - Auto-login username: `wooni.dev` (서버 사용자명)
4. **Connection → SSH → Auth → Credentials**:
   - Private key file for authentication: `.ppk` 파일 선택
5. **Connection → SSH → Tunnels**:
   - Source port: `9001`
   - Destination: `localhost:9001`
   - **Add** 클릭
6. **Session**으로 돌아가서:
   - Saved Sessions에 이름 입력 (예: `mypitch-minio-tunnel`)
   - **Save** 클릭
7. **Open**으로 연결

---

## 2단계: 터널 컨테이너 시작

PuTTY로 서버 접속 후 실행:

```bash
docker compose -f docker-compose.minio-tunnel.yml up -d
```

---

## 3단계: 브라우저 접속

로컬 PC 브라우저에서:

```
http://localhost:9001
```

MinIO 로그인 화면이 표시됩니다.

---

## 4단계: 사용 후 정리

서버에서 터널 컨테이너 종료:

```bash
docker compose -f docker-compose.minio-tunnel.yml down
```

PuTTY 창 닫기

---

## 다음에 접속할 때

1. PuTTY 실행
2. 저장된 세션 선택 → **Load** → **Open**
3. 서버에서 `docker compose -f docker-compose.minio-tunnel.yml up -d`
4. 브라우저에서 `http://localhost:9001` 접속

---

## 로그인 정보

MinIO Console 로그인 계정은 `.env` 파일에 설정되어 있습니다:

| 환경변수 | 설명 | 기본값 |
|---------|------|--------|
| `MINIO_ROOT_USER` | 관리자 아이디 | minioadmin |
| `MINIO_ROOT_PASSWORD` | 관리자 비밀번호 | minioadmin |

---

## 문제 해결

### 포트가 이미 사용 중인 경우

PuTTY 터널 설정에서 Source port를 다른 값으로 변경 (예: `19001`)

이 경우 `http://localhost:19001`로 접속

### 터널 컨테이너가 이미 존재하는 경우

```bash
docker rm -f minio-tunnel
```

### 네트워크를 찾을 수 없는 경우

```bash
# 네트워크 확인
docker network ls | grep my-pitch

# 메인 앱이 실행 중인지 확인
docker compose ls
```

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

다음 중 하나:
- PuTTY + WinSCP (Windows)
- Google Cloud SDK (gcloud CLI)
- 일반 SSH 클라이언트

---

## 방법 1: Docker Compose 사용 (권장)

`docker-compose.minio-tunnel.yml` 파일을 사용하여 간편하게 터널을 관리합니다.

### 1단계: SSH 터널 생성

**PuTTY 사용 (Windows):**

1. PuTTY 실행
2. 좌측 메뉴 **Connection → SSH → Tunnels** 클릭
3. 값 입력:
   - **Source port**: `9001`
   - **Destination**: `localhost:9001`
4. **Add** 버튼 클릭
5. **Session**으로 돌아가서 저장 후 **Open**

**WinSCP 사용 (Windows):**

1. WinSCP 실행 후 **새 사이트** 또는 기존 사이트 선택
2. **고급** 버튼 클릭
3. 좌측 메뉴 **연결 → 터널** 클릭
4. **SSH 터널을 통해 연결** 체크
5. 터널 호스트 정보 입력 (필요한 경우)
6. 좌측 메뉴 **SSH → 터널** 클릭
7. **로컬 포트 포워딩** 섹션에서 **추가** 클릭:
   - **원본 포트**: `9001`
   - **대상**: `localhost:9001`
8. **확인** 후 연결

또는 세션 설정에서:
1. 로그인 대화상자 → **고급** → **SSH** → **터널**
2. 하단 **로컬 포트 포워딩**에서 `9001:localhost:9001` 추가

**gcloud 사용:**

```bash
gcloud compute ssh [VM_인스턴스_이름] --zone=[ZONE] -- -L 9001:localhost:9001
```

**일반 SSH:**

```bash
ssh -L 9001:localhost:9001 [사용자]@[VM_외부_IP]
```

### 2단계: 터널 컨테이너 시작

SSH 접속한 서버에서:

```bash
docker compose -f docker-compose.minio-tunnel.yml up -d
```

### 3단계: 브라우저 접속

로컬 PC 브라우저에서:

```
http://localhost:9001
```

MinIO 로그인 화면이 표시됩니다.

### 4단계: 사용 후 정리

서버에서 터널 컨테이너 종료:

```bash
docker compose -f docker-compose.minio-tunnel.yml down
```

SSH 연결 종료 (PuTTY 창 닫기 또는 터미널에서 `exit`)

---

## 방법 2: 수동 Docker 명령어

Docker Compose 없이 직접 실행하는 방법입니다.

### 1단계: SSH 터널 생성

위 방법 1의 1단계와 동일

### 2단계: Docker 네트워크 브릿지 생성

SSH 접속한 서버에서 실행:

```bash
docker run --rm -d \
  --name minio-tunnel \
  --network my-pitch-network \
  -p 127.0.0.1:9001:9001 \
  alpine/socat \
  TCP-LISTEN:9001,fork,reuseaddr TCP:fileserver:9001
```

### 3단계: 브라우저 접속

로컬 PC 브라우저에서:

```
http://localhost:9001
```

### 4단계: 사용 후 정리

서버에서 터널 컨테이너 종료:

```bash
docker stop minio-tunnel
```

SSH 연결 종료

---

## 방법 3: 한 줄 명령어 (gcloud)

SSH 연결과 동시에 터널 컨테이너를 실행하고, 연결 종료 시 자동 정리:

```bash
gcloud compute ssh [VM_인스턴스_이름] --zone=[ZONE] -- \
  -L 9001:localhost:9001 \
  "docker run --rm --network my-pitch-network -p 127.0.0.1:9001:9001 alpine/socat TCP-LISTEN:9001,fork TCP:fileserver:9001"
```

실행 후 브라우저에서 `http://localhost:9001` 접속

SSH 연결을 끊으면 터널도 자동 종료됩니다.

---

## 예시 (실제 값 대입)

```bash
# VM 이름: my-pitch-server, Zone: asia-northeast3-a 인 경우
gcloud compute ssh my-pitch-server --zone=asia-northeast3-a -- \
  -L 9001:localhost:9001 \
  "docker run --rm --network my-pitch-network -p 127.0.0.1:9001:9001 alpine/socat TCP-LISTEN:9001,fork TCP:fileserver:9001"
```

---

## 로그인 정보

MinIO Console 로그인 시 사용하는 계정 정보는 `.env` 파일에 설정되어 있습니다:

| 환경변수 | 설명 | 기본값 |
|---------|------|--------|
| `MINIO_ROOT_USER` | 관리자 아이디 | minioadmin |
| `MINIO_ROOT_PASSWORD` | 관리자 비밀번호 | minioadmin |

---

## 문제 해결

### 포트가 이미 사용 중인 경우

```bash
# 로컬 9001 포트 사용 중인 프로세스 확인
lsof -i :9001

# 다른 포트로 터널링 (예: 19001)
gcloud compute ssh [VM_인스턴스_이름] --zone=[ZONE] -- -L 19001:localhost:9001
# 이 경우 http://localhost:19001 로 접속
```

### 터널 컨테이너가 이미 존재하는 경우

```bash
# 서버에서 기존 컨테이너 제거
docker rm -f minio-tunnel
```

### 네트워크를 찾을 수 없는 경우

```bash
# 서버에서 네트워크 확인
docker network ls | grep my-pitch

# 컨테이너가 실행 중인지 확인
docker ps | grep fileserver
```

---

## 참고 자료

- [socat 공식 문서](http://www.dest-unreach.org/socat/doc/socat.html)

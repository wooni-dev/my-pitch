# GPU 설정 가이드

Docker 컨테이너 내에서 NVIDIA GPU를 사용하기 위한 설정 가이드입니다.

## 📋 목차
- [사전 요구사항](#사전-요구사항)
- [NVIDIA Container Toolkit 설치](#nvidia-container-toolkit-설치)
- [Docker Compose 설정](#docker-compose-설정)
- [설치 확인](#설치-확인)
- [트러블슈팅](#트러블슈팅)

---

## 사전 요구사항

### 1. NVIDIA GPU 드라이버 설치 확인

```bash
nvidia-smi
```

다음과 같은 출력이 나와야 합니다:

```
+---------------------------------------------------------------------------------------+
| NVIDIA-SMI 535.261.03             Driver Version: 535.261.03   CUDA Version: 12.2     |
|-----------------------------------------+----------------------+----------------------+
| GPU  Name                 Persistence-M | Bus-Id        Disp.A | Volatile Uncorr. ECC |
...
```

- **Driver Version**: NVIDIA 드라이버 버전
- **CUDA Version**: 지원되는 최대 CUDA 버전 (이 버전 이하의 CUDA를 사용 가능)

### 2. Docker 및 Docker Compose 설치 확인

```bash
docker --version
docker compose version
```

Docker Compose v1.28.0 이상이 필요합니다 (GPU 설정 지원).

---

## NVIDIA Container Toolkit 설치

### 1. GPG 키 추가

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
    sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
```

### 2. 저장소 추가 (Ubuntu/Debian)

```bash
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
```

### 3. 패키지 설치

```bash
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
```

### 4. Docker에 GPU 런타임 설정

```bash
sudo nvidia-ctk runtime configure --runtime=docker
```

이 명령은 `/etc/docker/daemon.json` 파일을 자동으로 수정하여 NVIDIA 런타임을 추가합니다.

### 5. Docker 재시작

```bash
sudo systemctl restart docker
```

---

## Docker Compose 설정

### GPU 설정 추가

`docker-compose.prod.yml` (또는 `docker-compose.yml`)에서 GPU를 사용할 서비스에 다음 설정을 추가합니다:

```yaml
services:
  api:
    build:
      context: ./api
      dockerfile: Dockerfile.prod
    container_name: my-pitch-api
    
    # ... 기존 설정 ...
    
    # GPU 설정
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all  # 모든 GPU 사용 (특정 개수 지정: 1, 2 등)
              capabilities: [gpu]
    
    # ... 기타 설정 ...
```

### GPU 개수 제한 (선택사항)

특정 개수의 GPU만 사용하려면:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1  # GPU 1개만 사용
          capabilities: [gpu]
```

### 특정 GPU 선택 (선택사항)

특정 GPU ID를 지정하려면:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          device_ids: ['0']  # GPU 0번만 사용
          capabilities: [gpu]
```

---

## 설치 확인

### 1. Docker GPU 테스트

CUDA 컨테이너를 실행하여 GPU 인식 확인:

```bash
# CUDA 12.2 테스트 (드라이버가 지원하는 버전 사용)
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi

# 또는 CUDA 11.8 테스트 (PyTorch 등 많은 라이브러리가 사용)
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

성공하면 컨테이너 내부에서 `nvidia-smi` 출력이 표시됩니다.

### 2. 프로덕션 환경 실행

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 3. API 컨테이너에서 GPU 확인

```bash
docker exec -it my-pitch-api nvidia-smi
```

---

## 트러블슈팅

### 문제 1: `could not select device driver "nvidia" with capabilities: [[gpu]]`

**원인**: NVIDIA Container Toolkit이 설치되지 않았거나 Docker가 재시작되지 않음

**해결방법**:
```bash
# Toolkit 설치 확인
dpkg -l | grep nvidia-container-toolkit

# Docker 재시작
sudo systemctl restart docker

# 테스트
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

### 문제 2: `nvidia-smi: command not found` (호스트에서)

**원인**: NVIDIA GPU 드라이버가 설치되지 않음

**해결방법**:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y nvidia-driver-535
sudo reboot
```

### 문제 3: Nginx 설정 오류 - `named location can be on the server level only`

**원인**: Named location (`@...`)이 잘못된 중첩 레벨에 정의됨

**해결방법**: Named location을 `location` 블록 안이 아닌 `server` 블록 레벨에 정의

**잘못된 예**:
```nginx
server {
    location / {
        error_page 413 @request_entity_too_large;
        
        location @request_entity_too_large {  # ❌ 중첩된 location 안에 있음
            return 413 '{"message": "..."}';
        }
    }
}
```

**올바른 예**:
```nginx
server {
    location / {
        error_page 413 @request_entity_too_large;
    }
    
    location @request_entity_too_large {  # ✅ server 레벨에 정의
        return 413 '{"message": "..."}';
    }
}
```

### 문제 4: Docker Compose GPU 설정이 인식되지 않음

**원인**: Docker Compose 버전이 너무 낮음 (v1.28.0 미만)

**해결방법**:
```bash
# Docker Compose 버전 확인
docker compose version

# 필요시 Docker Compose 업데이트
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

---

## 📚 참고 자료

### CUDA 버전 선택 가이드

| 사용 라이브러리 | 권장 CUDA 버전 | Docker 이미지 예시 |
|---|---|---|
| PyTorch 2.x | 11.8 또는 12.1 | `pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime` |
| TensorFlow 2.12-2.13 | 11.8 | `tensorflow/tensorflow:2.13.0-gpu` |
| 최신 CUDA 기능 | 12.2+ | `nvidia/cuda:12.2.0-cudnn8-runtime-ubuntu22.04` |

### Dockerfile에서 GPU 지원 베이스 이미지 사용

```dockerfile
# CUDA 런타임 이미지
FROM nvidia/cuda:12.2.0-cudnn8-runtime-ubuntu22.04

# 또는 PyTorch 공식 이미지
FROM pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime

# Python 패키지 설치 등...
```

### 유용한 명령어

```bash
# GPU 사용 중인 프로세스 확인
nvidia-smi

# 실시간 GPU 모니터링
watch -n 1 nvidia-smi

# 컨테이너 내부에서 GPU 확인
docker exec -it my-pitch-api nvidia-smi

# Docker GPU 런타임 설정 확인
cat /etc/docker/daemon.json
```

---

## 💡 추가 팁

### GPU 메모리 사용량 제한 (PyTorch)

코드에서 GPU 메모리 사용을 제한하려면:

```python
import torch

# GPU 메모리 제한 (예: 최대 8GB)
torch.cuda.set_per_process_memory_fraction(0.5)  # 50% 사용

# 또는 환경 변수로 설정
# PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
```

### 환경 변수로 GPU 선택

```yaml
environment:
  - CUDA_VISIBLE_DEVICES=0  # GPU 0번만 사용
  # 또는
  - CUDA_VISIBLE_DEVICES=0,1  # GPU 0번, 1번 사용
```

---

## ✅ 설정 완료 체크리스트

- [ ] `nvidia-smi` 명령 정상 실행
- [ ] NVIDIA Container Toolkit 설치 완료
- [ ] Docker GPU 런타임 설정 완료
- [ ] Docker 재시작 완료
- [ ] `docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi` 테스트 성공
- [ ] `docker-compose.prod.yml`에 GPU 설정 추가
- [ ] 프로덕션 환경에서 컨테이너 내부 GPU 인식 확인

모든 항목이 체크되면 GPU 설정이 완료된 것입니다! 🎉


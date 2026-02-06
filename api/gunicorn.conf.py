"""
Gunicorn 프로덕션 설정 파일
https://gunicorn.org/reference/settings/
"""
import os

# 서버 소켓
bind = "0.0.0.0:5000"
backlog = 2048

# Worker 프로세스
# demucs가 GPU/CPU를 많이 사용하므로 1개씩 순차 처리 (리소스 제한 환경)
# 트래픽 증가 및 하드웨어 업그레이드 시 2~4로 증가 권장
workers = int(os.environ.get("GUNICORN_WORKERS", "1"))
worker_class = "sync"  # 오디오 처리는 CPU 집약적이므로 sync worker 사용
max_requests = 0  # Worker 재시작 비활성화 (인메모리 job_queue 유지를 위해 필수)
timeout = 600  # 오디오 처리 시간을 고려한 긴 타임아웃 (10분, nginx와 동일)

# 로깅
accesslog = "-"  # stdout으로 출력 (Docker 로그에 포함)
# IP, 시간, "요청", 상태코드, 응답크기, 처리시간(μs)
access_log_format = '%(h)s %(t)s "%(r)s" %(s)s %(b)s %(D)s'
errorlog = "-"  # stderr로 출력 (Docker 로그에 포함)
loglevel = os.environ.get("LOG_LEVEL", "info")

# 프로세스 이름
proc_name = "my-pitch-api"

# 서버 훅
def post_fork(server, worker):
    """Worker 생성 후 - PID 로깅"""
    server.log.info(f"Worker spawned (pid: {worker.pid})")

def worker_abort(worker):
    """Worker 타임아웃 - 경고 로깅"""
    worker.log.warning(f"Worker timeout (pid: {worker.pid})")


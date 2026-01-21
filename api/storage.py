from minio import Minio
from minio.error import S3Error

from config import (
    MINIO_ENDPOINT,
    MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY,
    ORIGINAL_BUCKET,
    SEPARATED_BUCKET
)


def init_minio_client():
    """
    MinIO 클라이언트를 초기화하고 반환
    
    Returns:
        Minio: 초기화된 MinIO 클라이언트
    """
    # https://docs.min.io/enterprise/aistor-object-store/developers/sdk/python/api/#1-constructor
    client = Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False  # HTTP 사용 (개발 환경)
    )
    return client


def init_buckets(minio_client):
    """
    필요한 버킷들을 생성 (없는 경우에만)
    
    Args:
        minio_client: MinIO 클라이언트 인스턴스
    """
    buckets = [ORIGINAL_BUCKET, SEPARATED_BUCKET]
    
    for bucket_name in buckets:
        try:
            # 버킷이 없으면 생성
            if not minio_client.bucket_exists(bucket_name):
                minio_client.make_bucket(bucket_name)
                print(f"버킷 '{bucket_name}' 생성 완료")
        except S3Error as e:
            print(f"버킷 '{bucket_name}' 확인/생성 중 오류: {e}")


def setup_storage():
    """
    스토리지 설정을 초기화하고 MinIO 클라이언트 반환
    
    Returns:
        Minio: 설정이 완료된 MinIO 클라이언트
    """
    client = init_minio_client()
    init_buckets(client)
    return client


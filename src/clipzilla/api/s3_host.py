"""AWS S3 temporary video hosting for platforms that require public URLs.

Used by Instagram and Facebook publishers which pull videos from a URL
rather than accepting direct file uploads.
"""
import logging
import os
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger("clipzilla.api.s3_host")

def get_s3_bucket() -> str:
    return os.getenv("CLIPZILLA_S3_BUCKET") or os.getenv("AWS_S3_BUCKET", "")


def get_s3_region() -> str:
    return os.getenv("CLIPZILLA_S3_REGION") or os.getenv("AWS_DEFAULT_REGION") or os.getenv("AWS_REGION", "us-east-1")


def get_s3_prefix() -> str:
    return os.getenv("CLIPZILLA_S3_PREFIX", "clipzilla-temp/")


def _get_s3_client():
    """Returns a boto3 S3 client using standard credential chain or explicitly configured env keys."""
    kwargs = {"region_name": get_s3_region()}
    aws_key = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret = os.getenv("AWS_SECRET_ACCESS_KEY")
    if aws_key and aws_secret:
        kwargs["aws_access_key_id"] = aws_key
        kwargs["aws_secret_access_key"] = aws_secret
    return boto3.client("s3", **kwargs)


def upload_to_s3(file_path: Path, object_key: Optional[str] = None) -> str:
    """Uploads a video file to S3 and returns a pre-signed URL valid for 1 hour.
    
    Args:
        file_path: Local path to the video file.
        object_key: Optional S3 key. Defaults to S3_PREFIX + filename.
    
    Returns:
        Pre-signed HTTPS URL for the uploaded file.
    
    Raises:
        ValueError: If S3 bucket is not configured.
        ClientError: If S3 upload fails.
    """
    bucket = get_s3_bucket()
    if not bucket:
        raise ValueError(
            "S3 bucket not configured. Set CLIPZILLA_S3_BUCKET or AWS_S3_BUCKET on the Accounts dashboard."
        )
    
    prefix = get_s3_prefix()
    if object_key is None:
        object_key = f"{prefix}{file_path.name}"
    
    client = _get_s3_client()
    
    logger.info(f"Uploading {file_path.name} to s3://{bucket}/{object_key}")
    client.upload_file(
        str(file_path),
        bucket,
        object_key,
        ExtraArgs={"ContentType": "video/mp4"},
    )
    
    # Generate pre-signed URL valid for 1 hour
    presigned_url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": object_key},
        ExpiresIn=3600,
    )
    
    logger.info(f"Upload complete. Pre-signed URL generated for {object_key}")
    return presigned_url


def delete_from_s3(object_key: str) -> None:
    """Deletes a temporary video file from S3 after publishing completes."""
    if not S3_BUCKET:
        return
    
    try:
        client = _get_s3_client()
        client.delete_object(Bucket=S3_BUCKET, Key=object_key)
        logger.info(f"Cleaned up s3://{S3_BUCKET}/{object_key}")
    except ClientError as e:
        logger.warning(f"Failed to clean up S3 object {object_key}: {e}")


def get_object_key_for_clip(clip_id: str, filename: str) -> str:
    """Generates a consistent S3 object key for a clip."""
    return f"{S3_PREFIX}{clip_id}/{filename}"

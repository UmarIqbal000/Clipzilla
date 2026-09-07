import queue
import threading
import logging
import time
from pathlib import Path
from typing import Optional

from clipzilla.api.database import (
    get_publish_job,
    update_publish_job_status,
    get_social_account,
    get_clip,
    update_social_account,
    get_pending_scheduled_publishes,
)
from clipzilla.api.credentials import decrypt_credentials, encrypt_credentials
from clipzilla.api.publishers import get_publisher
from clipzilla.api.s3_host import upload_to_s3, delete_from_s3, get_object_key_for_clip

logger = logging.getLogger("clipzilla.api.publish_worker")

publish_queue: queue.Queue = queue.Queue()
_worker_started = False
_worker_lock = threading.Lock()


def process_publish_job(publish_job_id: str):
    """Processes a single publish job."""
    job = get_publish_job(publish_job_id)
    if not job:
        logger.error(f"Publish job {publish_job_id} not found in database.")
        return

    clip_id = job.get("clip_id")
    account_id = job.get("account_id")
    
    clip = get_clip(clip_id)
    account = get_social_account(account_id)
    
    if not clip or not account:
        logger.error(f"Missing clip or account for publish job {publish_job_id}")
        update_publish_job_status(publish_job_id, status="failed", error_message="Missing clip or account.")
        return

    platform = account.get("platform")
    credentials_enc = account.get("credentials")
    if not credentials_enc:
        update_publish_job_status(publish_job_id, status="failed", error_message="Missing credentials.")
        return
    
    try:
        credentials = decrypt_credentials(credentials_enc)
    except Exception as e:
        logger.exception(f"Failed to decrypt credentials for job {publish_job_id}")
        update_publish_job_status(publish_job_id, status="failed", error_message=f"Failed to decrypt credentials: {e}")
        return

    publisher = get_publisher(platform)
    if not publisher:
        update_publish_job_status(publish_job_id, status="failed", error_message=f"No publisher found for platform {platform}.")
        return

    # Check for token refresh
    try:
        if hasattr(publisher, "needs_refresh") and publisher.needs_refresh(credentials):
            credentials = publisher.refresh_token(credentials)
            update_social_account(account_id, credentials=encrypt_credentials(credentials))
    except Exception as e:
        logger.exception(f"Failed to refresh token for account {account_id}")
        update_publish_job_status(publish_job_id, status="failed", error_message=f"Failed to refresh token: {e}")
        return

    file_path = Path(clip["file_path"]).resolve()
    if not file_path.exists():
        update_publish_job_status(publish_job_id, status="failed", error_message="Clip file not found.")
        return

    s3_object_key = None
    video_url = None
    
    # Upload to S3 if Instagram or Facebook
    if platform in ("instagram", "facebook"):
        s3_object_key = get_object_key_for_clip(clip_id, file_path.name)
        try:
            update_publish_job_status(publish_job_id, status="publishing", progress=5, stage_message="Uploading to temporary S3 storage...")
            video_url = upload_to_s3(file_path, s3_object_key)
        except Exception as e:
            logger.exception(f"Failed to upload {file_path} to S3")
            update_publish_job_status(publish_job_id, status="failed", error_message=f"Failed to upload to S3: {e}")
            return

    def progress_callback(progress: int, stage_message: Optional[str] = None):
        msg = stage_message or f"Uploading to {platform}... ({progress}%)"
        update_publish_job_status(publish_job_id, status="publishing", progress=progress, stage_message=msg)

    retries = 1
    delay = 5
    for attempt in range(retries + 1):
        try:
            update_publish_job_status(publish_job_id, status="publishing", progress=10, stage_message="Starting publish to platform...")
            
            raw_tags = job.get("tags") or ""
            if isinstance(raw_tags, str):
                tags_list = [t.strip().lstrip("#") for t in raw_tags.replace(",", " ").split() if t.strip()]
            elif isinstance(raw_tags, list):
                tags_list = [str(t).strip().lstrip("#") for t in raw_tags]
            else:
                tags_list = []

            metadata = {
                "title": job.get("title") or clip.get("title", ""),
                "description": job.get("description", ""),
                "tags": tags_list,
                "privacy": job.get("privacy", "public"),
                "duration": float(clip.get("duration", 0)),
            }
            if video_url:
                metadata["video_url"] = video_url
                
            result = publisher.upload_video(
                video_path=file_path,
                metadata=metadata,
                credentials=credentials,
                on_progress=progress_callback,
            )
            
            post_id = result.get("platform_post_id") or result.get("post_id")
            post_url = result.get("platform_post_url") or result.get("post_url")

            update_publish_job_status(
                publish_job_id,
                status="published",
                progress=100,
                stage_message="Successfully published.",
                platform_post_id=post_id,
                platform_post_url=post_url,
            )
            break
        except Exception as e:
            logger.warning(f"Attempt {attempt + 1} failed for publish job {publish_job_id}: {e}")
            if attempt < retries:
                time.sleep(delay)
            else:
                logger.exception(f"All retries failed for publish job {publish_job_id}")
                update_publish_job_status(publish_job_id, status="failed", error_message=str(e))
    
    # Cleanup S3
    if s3_object_key:
        try:
            delete_from_s3(s3_object_key)
        except Exception as e:
            logger.error(f"Failed to clean up S3 object {s3_object_key}: {e}")


def _publish_worker_loop():
    """Background worker processing publish jobs sequentially."""
    logger.info("In-process background publish worker started.")
    last_schedule_check = time.time()
    
    while True:
        try:
            # Check for scheduled jobs every 60 seconds
            current_time = time.time()
            if current_time - last_schedule_check >= 60:
                try:
                    pending_jobs = get_pending_scheduled_publishes()
                    for job in pending_jobs:
                        publish_queue.put(job["id"])
                except Exception as e:
                    logger.error(f"Error checking scheduled publishes: {e}")
                last_schedule_check = current_time

            # Use timeout to allow checking for scheduled jobs periodically
            try:
                job_id = publish_queue.get(timeout=10)
                if job_id is None:
                    break
                process_publish_job(job_id)
                publish_queue.task_done()
            except queue.Empty:
                continue

        except Exception as e:
            logger.error(f"Publish worker loop error: {e}")
            time.sleep(5)


def start_publish_worker():
    """Starts the background publish worker thread if not already running."""
    global _worker_started
    with _worker_lock:
        if not _worker_started:
            thread = threading.Thread(target=_publish_worker_loop, daemon=True, name="ClipzillaPublishWorker")
            thread.start()
            _worker_started = True


def enqueue_publish(publish_job_id: str):
    """Enqueues a publish job ID for processing."""
    start_publish_worker()
    publish_queue.put(publish_job_id)

import queue
import threading
import logging
import subprocess
import json
import re
from pathlib import Path
from typing import Optional

from clipzilla.config import DEFAULT_WORKDIR, get_llm_provider
from clipzilla.downloader import download_video
from clipzilla.transcriber import transcribe_video
from clipzilla.analyzer import run_analysis_for_video
from clipzilla.clipper import cut_clip
from clipzilla.api.database import (
    get_job,
    update_job_status,
    add_clip,
)

logger = logging.getLogger("clipzilla.worker")

# In-process queue
job_queue: queue.Queue = queue.Queue()
_worker_started = False
_worker_lock = threading.Lock()


def sanitize_slug(name: str) -> str:
    """Sanitizes clip title into a safe filename."""
    s = re.sub(r"[^\w\s-]", "", name).strip()
    return re.sub(r"[-\s]+", "_", s)


def generate_clip_thumbnail(video_file: Path, output_image: Path, time_offset: float = 0.5):
    """Extracts a high-quality poster frame from video using FFmpeg."""
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(time_offset),
        "-i", str(video_file),
        "-vframes", "1",
        "-q:v", "2",
        str(output_image),
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except Exception as e:
        logger.warning(f"Failed to generate thumbnail for {video_file.name}: {e}")


def process_job(job_id: str):
    """Runs the complete auto pipeline for a single queued job."""
    job = get_job(job_id)
    if not job:
        logger.error(f"Job {job_id} not found in database.")
        return

    url = job["url"]
    preset = job.get("preset") or "karaoke"
    reframe = job.get("reframe") or "auto"

    try:
        logger.info(f"Starting job {job_id} for URL: {url}")

        # 1. Download
        update_job_status(job_id, status="downloading", progress=10, stage_message="Downloading YouTube video capped at 1080p...")
        dl_res = download_video(url=url, workdir=DEFAULT_WORKDIR)
        video_dir = dl_res["video_dir"]
        video_id = dl_res["video_id"]
        update_job_status(job_id, status="downloading", progress=25, stage_message="Video downloaded successfully", video_id=video_id)

        # 2. Transcribe
        update_job_status(job_id, status="transcribing", progress=30, stage_message="Extracting word-level timestamps...")
        transcript_path = video_dir / "transcript.json"
        if not transcript_path.exists() or transcript_path.stat().st_size == 0:
            transcribe_video(video_dir=video_dir)
        update_job_status(job_id, status="transcribing", progress=50, stage_message="Transcription ready", video_id=video_id)

        # 3. Analyze
        update_job_status(job_id, status="analyzing", progress=55, stage_message="Prompting LLM to identify viral short-form clips...")
        suggestions_path = video_dir / "clips_suggested.json"
        if not suggestions_path.exists() or suggestions_path.stat().st_size == 0:
            llm_provider = get_llm_provider()
            run_analysis_for_video(video_dir=video_dir, provider=llm_provider)

        with open(suggestions_path, "r", encoding="utf-8") as f:
            clips_data = json.load(f)

        if not clips_data:
            raise ValueError("No clip candidates identified by analysis.")

        update_job_status(
            job_id,
            status="analyzing",
            progress=65,
            stage_message=f"Identified {len(clips_data)} clip candidates",
            video_id=video_id,
        )

        # 4. Render clips
        update_job_status(
            job_id,
            status="rendering",
            progress=70,
            stage_message=f"Reframing and rendering 1080x1920 shorts (0/{len(clips_data)})...",
            video_id=video_id,
        )

        clips_dir = video_dir / "clips"
        clips_dir.mkdir(parents=True, exist_ok=True)

        for idx, clip_info in enumerate(clips_data, 1):
            start = float(clip_info["start_time"])
            end = float(clip_info["end_time"])
            title = clip_info.get("title", f"Clip {idx}")
            reason = clip_info.get("reason", "")
            needs_trimming = bool(clip_info.get("needs_trimming", False))
            trimming_notes = clip_info.get("trimming_notes", "")

            slug = sanitize_slug(title)
            clip_filename = f"clip_{idx:02d}_{slug[:30]}.mp4"
            thumb_filename = f"thumb_{idx:02d}_{slug[:30]}.jpg"

            out_clip_path = clips_dir / clip_filename
            thumb_path = clips_dir / thumb_filename

            # Render clip
            cut_clip(
                video_dir=video_dir,
                start=start,
                end=end,
                output_path=out_clip_path,
                burn_subtitles=True,
                reframe_mode=reframe,
                subtitle_preset=preset,
            )

            # Generate thumbnail poster
            if not thumb_path.exists() or thumb_path.stat().st_size == 0:
                generate_clip_thumbnail(out_clip_path, thumb_path)

            clip_id = f"{job_id}_{idx}"
            duration = end - start
            add_clip(
                clip_id=clip_id,
                job_id=job_id,
                video_id=video_id,
                title=title,
                start_time=start,
                end_time=end,
                duration=duration,
                reason=reason,
                needs_trimming=needs_trimming,
                trimming_notes=trimming_notes,
                file_path=str(out_clip_path),
                thumbnail_path=str(thumb_path) if thumb_path.exists() else None,
            )

            current_progress = 70 + int((idx / len(clips_data)) * 28)
            update_job_status(
                job_id,
                status="rendering",
                progress=current_progress,
                stage_message=f"Rendered clip {idx}/{len(clips_data)}: '{title}'",
                video_id=video_id,
            )

        # 5. Done
        update_job_status(
            job_id,
            status="done",
            progress=100,
            stage_message=f"Complete! Generated {len(clips_data)} shorts.",
            video_id=video_id,
        )
        logger.info(f"Job {job_id} successfully finished.")

    except Exception as e:
        logger.exception(f"Job {job_id} failed: {e}")
        update_job_status(
            job_id,
            status="failed",
            progress=0,
            error_message=str(e),
            stage_message=f"Failed: {e}",
        )


def _worker_loop():
    """Background worker processing jobs one at a time."""
    logger.info("In-process background worker started.")
    while True:
        try:
            job_id = job_queue.get()
            if job_id is None:
                break
            process_job(job_id)
        except Exception as e:
            logger.error(f"Worker loop error: {e}")
        finally:
            job_queue.task_done()


def start_worker():
    """Starts the background worker thread if not already running."""
    global _worker_started
    with _worker_lock:
        if not _worker_started:
            thread = threading.Thread(target=_worker_loop, daemon=True, name="ClipzillaWorker")
            thread.start()
            _worker_started = True


def enqueue_job(job_id: str):
    """Enqueues a job ID for processing."""
    start_worker()
    job_queue.put(job_id)

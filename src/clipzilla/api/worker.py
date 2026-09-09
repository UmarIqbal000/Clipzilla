import queue
import threading
import logging
import subprocess
import json
import re
from pathlib import Path
from typing import Optional

from clipzilla.config import DEFAULT_WORKDIR, DEFAULT_OUTPUT_DIR, get_llm_provider
from clipzilla.downloader import download_video, delete_source_video
from clipzilla.transcriber import transcribe_video
from clipzilla.analyzer import run_analysis_for_video
from clipzilla.clipper import cut_clip
from clipzilla.api.database import (
    get_job,
    update_job_status,
    add_clip,
    get_clip,
    update_clip_render_status,
    update_clip_rendered,
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


def rerender_clip_task(clip_id: str):
    """
    Re-renders a clip from the full-resolution source video using user edits.
    Reuses existing transcript and analysis; only re-crops, re-captions, and re-exports.
    """
    try:
        clip = get_clip(clip_id)
        if not clip:
            logger.error(f"Cannot rerender: clip {clip_id} not found in database.")
            return

        video_id = clip["video_id"]
        video_dir = DEFAULT_WORKDIR / video_id
        parent_job = get_job(clip.get("job_id", ""))
        export_preset = parent_job.get("export_preset", "youtube_shorts") if parent_job else "youtube_shorts"

        edits = clip.get("edits") or {}
        start_time = float(edits.get("trim_start", clip["start_time"]))
        end_time = float(edits.get("trim_end", clip["end_time"]))
        duration = max(0.1, end_time - start_time)

        style = edits.get("style") or {}
        preset = style.get("preset") or "karaoke"
        font_name = style.get("font_name") or "Arial"
        font_size = style.get("font_size")
        highlight_color = style.get("highlight_color") or "&H0000FFFF&"
        text_color = style.get("text_color") or "&H00FFFFFF&"
        position = style.get("position") or "bottom"

        crop_override = edits.get("crop_override")
        caption_overrides = edits.get("captions")

        target_file = Path(clip["file_path"]).resolve()
        thumb_file = Path(clip["thumbnail_path"]).resolve() if clip.get("thumbnail_path") else target_file.with_suffix(".jpg")

        # Verify source video is present
        source_found = any(
            f.is_file() and f.name.startswith("source.") and f.suffix.lower() in [".mp4", ".mkv", ".webm", ".mov"]
            for f in video_dir.iterdir()
        ) if video_dir.exists() else False

        if not source_found:
            raise FileNotFoundError(
                "Original downloaded source video was deleted to free disk space. Re-rendering requires the source video."
            )

        logger.info(f"Re-rendering clip {clip_id} ({start_time:.2f}s - {end_time:.2f}s, preset={preset}, font={font_name}, size={font_size}, export_preset={export_preset})...")

        # Re-cut clip with overwrite=True using full-res source
        cut_clip(
            video_dir=video_dir,
            start=start_time,
            end=end_time,
            output_path=target_file,
            burn_subtitles=True,
            subtitle_preset=preset,
            font_name=font_name,
            font_size=font_size,
            highlight_color=highlight_color,
            text_color=text_color,
            position=position,
            overwrite=True,
            crop_override=crop_override,
            caption_overrides=caption_overrides,
            export_preset=export_preset,
        )

        # Regenerate thumbnail
        generate_clip_thumbnail(target_file, thumb_file)

        # Update database state
        update_clip_rendered(
            clip_id=clip_id,
            start_time=start_time,
            end_time=end_time,
            duration=duration,
            file_path=str(target_file),
            thumbnail_path=str(thumb_file),
        )
        logger.info(f"Clip {clip_id} successfully re-rendered and updated in DB.")

    except Exception as e:
        logger.exception(f"Error re-rendering clip {clip_id}: {e}")
        update_clip_render_status(clip_id=clip_id, status="failed", error=str(e))


def enqueue_rerender(clip_id: str):
    """Runs a single clip re-render task in a background daemon thread."""
    update_clip_render_status(clip_id=clip_id, status="rendering", error=None)
    thread = threading.Thread(
        target=rerender_clip_task,
        args=(clip_id,),
        daemon=True,
        name=f"Rerender_{clip_id}",
    )
    thread.start()


def process_job(job_id: str):
    """Runs the complete auto pipeline for a single queued job."""
    job = get_job(job_id)
    if not job:
        logger.error(f"Job {job_id} not found in database.")
        return

    url = job["url"]
    preset = job.get("preset") or "karaoke"
    reframe = job.get("reframe") or "auto"
    export_preset = job.get("export_preset") or "youtube_shorts"
    profile_id = job.get("profile_id")
    output_dir = job.get("output_dir")
    delete_source = bool(job.get("delete_source", 1))
    num_clips = job.get("num_clips")

    try:
        logger.info(f"Starting job {job_id} for URL: {url} (preset={preset}, export_preset={export_preset}, profile={profile_id}, output_dir={output_dir}, delete_source={delete_source}, num_clips={num_clips})")

        # 1. Download
        update_job_status(job_id, status="downloading", progress=10, stage_message="Downloading YouTube video capped at 1080p...")
        dl_res = download_video(url=url, workdir=DEFAULT_WORKDIR)
        video_dir = dl_res["video_dir"]
        video_id = dl_res["video_id"]
        video_title = dl_res.get("metadata", {}).get("title") or "YouTube Video"

        update_job_status(
            job_id,
            status="downloading",
            progress=25,
            stage_message=f"Downloaded '{video_title}'",
            video_id=video_id,
            video_title=video_title,
        )

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
            llm_provider = get_llm_provider(profile_id=profile_id)

            def on_analysis_progress(step: int, total: int, msg: str):
                pct = 55 + int(10 * (step / max(1, total)))
                update_job_status(job_id, status="analyzing", progress=pct, stage_message=msg, video_id=video_id)

            run_analysis_for_video(
                video_dir=video_dir,
                provider=llm_provider,
                export_preset=export_preset,
                num_clips=num_clips,
                progress_callback=on_analysis_progress,
            )

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
        clips_dir = Path(output_dir) if output_dir else DEFAULT_OUTPUT_DIR
        clips_dir.mkdir(parents=True, exist_ok=True)

        update_job_status(
            job_id,
            status="rendering",
            progress=70,
            stage_message=f"Reframing and rendering shorts to {clips_dir.name}/ (0/{len(clips_data)})...",
            video_id=video_id,
        )

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
                export_preset=export_preset,
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

        # 5. Cleanup: Delete original downloaded video if requested
        if delete_source:
            del_res = delete_source_video(video_dir=video_dir)
            if del_res.get("deleted_files"):
                freed_mb = del_res["freed_bytes"] / (1024 * 1024)
                logger.info(f"Deleted source video for job {job_id} ({freed_mb:.2f} MB freed)")

        # 6. Done
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

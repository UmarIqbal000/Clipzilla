import uuid
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from clipzilla.config import DEFAULT_WORKDIR
from clipzilla.presets import EXPORT_PRESETS, get_export_preset
from clipzilla.downloader import generate_proxy_video
from clipzilla.reframe import get_speaker_crop_path
from clipzilla.subtitles import group_words_into_phrases
from clipzilla.api.database import (
    init_db,
    create_job,
    get_job,
    list_jobs,
    get_clips_for_job,
    get_all_clips,
    get_clip,
    update_clip_edits,
    update_clip_render_status,
    get_jobs_by_batch,
    get_clips_by_batch,
    get_project_history,
    delete_job,
    delete_failed_jobs,
    delete_clip,
)
from clipzilla.api.worker import enqueue_job, start_worker, enqueue_rerender
from clipzilla.api.settings import (
    get_safe_settings,
    update_settings,
    get_safe_profiles,
    save_profile,
    delete_profile,
    set_active_profile,
)

logger = logging.getLogger("clipzilla.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and worker thread on startup
    init_db()
    start_worker()
    yield


app = FastAPI(
    title="Clipzilla API",
    description="Local web API for Clipzilla: monster that devours long-form and spits out shorts.",
    version="0.1.0",
    lifespan=lifespan,
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request & Response Schemas
class CreateJobRequest(BaseModel):
    url: Optional[str] = Field(None, description="Single YouTube video URL")
    urls: Optional[List[str]] = Field(None, description="List of YouTube video URLs for batch mode")
    preset: Optional[str] = Field("karaoke", description="Subtitle animation preset ('karaoke' or 'single')")
    reframe: Optional[str] = Field("auto", description="Reframing strategy ('auto', 'face', 'blur', 'center')")
    export_preset: Optional[str] = Field("youtube_shorts", description="Export preset ('youtube_shorts', 'tiktok', 'instagram_reels')")
    profile_id: Optional[str] = Field(None, description="Named provider profile ID to use for analysis")
    output_dir: Optional[str] = Field(None, description="Custom directory to store exported clips")
    delete_source: Optional[bool] = Field(True, description="Delete original downloaded source video after clips are generated")
    num_clips: Optional[int] = Field(None, ge=1, le=50, description="Target number of clips to generate (e.g. 5, 10, 15)")


class SettingsUpdateRequest(BaseModel):
    provider: Optional[str] = None
    providers: Optional[Dict[str, Dict[str, Any]]] = None
    active_profile: Optional[str] = None


class ProfileCreateOrUpdateRequest(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1)
    provider_type: str = Field(..., description="'ollama_local', 'ollama_cloud', or 'openai_compat'")
    base_url: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    api_key: Optional[str] = None
    is_active: Optional[bool] = False


class ActiveProfileRequest(BaseModel):
    profile_id: str


class ClipEditsRequest(BaseModel):
    trim_start: Optional[float] = None
    trim_end: Optional[float] = None
    captions: Optional[List[Dict[str, Any]]] = None
    crop_override: Optional[Dict[str, Any]] = None
    style: Optional[Dict[str, Any]] = None



@app.get("/health")
def health_check():
    return {"status": "ok", "app": "Clipzilla"}


@app.post("/jobs", status_code=status.HTTP_201_CREATED)
def submit_job(req: CreateJobRequest):
    """
    Submits a single YouTube URL or a batch of URLs to be converted into shorts in the background.
    Multiple URLs are processed sequentially by the background queue.
    """
    # 1. Parse target URLs
    target_urls: List[str] = []
    if req.urls:
        for u in req.urls:
            u_clean = u.strip()
            if u_clean:
                target_urls.append(u_clean)
    elif req.url:
        # Split by newlines or commas if multiline text was submitted
        raw_lines = [line.strip() for line in req.url.replace(",", "\n").splitlines()]
        target_urls = [line for line in raw_lines if line]

    if not target_urls:
        raise HTTPException(status_code=400, detail="At least one YouTube URL is required.")

    preset = req.preset or "karaoke"
    reframe = req.reframe or "auto"
    export_preset = req.export_preset or "youtube_shorts"
    profile_id = req.profile_id
    output_dir = req.output_dir
    delete_source = True if req.delete_source is None else bool(req.delete_source)
    num_clips = req.num_clips

    # 2. Batch mode: more than 1 URL
    if len(target_urls) > 1:
        batch_id = f"batch_{uuid.uuid4().hex[:8]}"
        created_jobs = []
        for url in target_urls:
            job_id = str(uuid.uuid4())
            job = create_job(
                job_id=job_id,
                url=url,
                preset=preset,
                reframe=reframe,
                batch_id=batch_id,
                export_preset=export_preset,
                profile_id=profile_id,
                output_dir=output_dir,
                delete_source=delete_source,
                num_clips=num_clips,
            )
            enqueue_job(job_id)
            created_jobs.append(job)

        return {
            "batch_id": batch_id,
            "count": len(created_jobs),
            "jobs": created_jobs,
            "status": "queued",
            "id": created_jobs[0]["id"],
            "url": created_jobs[0]["url"],
            "progress": 0,
            "stage_message": f"Queued {len(created_jobs)} videos for sequential processing",
        }

    # 3. Single URL
    single_url = target_urls[0]
    job_id = str(uuid.uuid4())
    job = create_job(
        job_id=job_id,
        url=single_url,
        preset=preset,
        reframe=reframe,
        batch_id=None,
        export_preset=export_preset,
        profile_id=profile_id,
        output_dir=output_dir,
        delete_source=delete_source,
        num_clips=num_clips,
    )
    enqueue_job(job_id)
    return {
        "id": job["id"],
        "url": job["url"],
        "status": job["status"],
        "progress": job["progress"],
        "stage_message": job["stage_message"],
        "batch_id": job.get("batch_id"),
        "export_preset": job.get("export_preset"),
        "profile_id": job.get("profile_id"),
    }


@app.get("/jobs")
def get_all_jobs():
    """Lists recent jobs."""
    return list_jobs()


@app.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    """Returns the live status, progress, and stage message of a job."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


@app.get("/clips")
def get_all_clips_endpoint():
    """Returns all generated clips across all jobs and batches."""
    clips = get_all_clips()
    results = []
    for c in clips:
        clip_dict = dict(c)
        clip_id = clip_dict["id"]
        clip_dict["video_url"] = f"/clips/{clip_id}/video"
        clip_dict["thumbnail_url"] = f"/clips/{clip_id}/thumbnail" if clip_dict.get("thumbnail_path") else None
        results.append(clip_dict)
    return results


@app.get("/jobs/{job_id}/clips")
def get_job_clips(job_id: str):
    """Returns all generated clips and metadata for a job."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    clips = get_clips_for_job(job_id)
    results = []
    for c in clips:
        clip_dict = dict(c)
        clip_id = clip_dict["id"]
        clip_dict["video_url"] = f"/clips/{clip_id}/video"
        clip_dict["thumbnail_url"] = f"/clips/{clip_id}/thumbnail" if clip_dict.get("thumbnail_path") else None
        results.append(clip_dict)
    return results


@app.get("/clips/{clip_id}/video")
def stream_clip_video(clip_id: str):
    """Streams the rendered MP4 short for playback or download."""
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    file_path = Path(clip["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file on disk not found")

    safe_title = "".join(c for c in clip["title"] if c.isalnum() or c in (" ", "_", "-")).strip()
    return FileResponse(
        path=str(file_path),
        media_type="video/mp4",
        filename=f"{safe_title}.mp4",
    )


@app.get("/clips/{clip_id}/thumbnail")
def get_clip_thumbnail(clip_id: str):
    """Serves the thumbnail poster image for the clip."""
    clip = get_clip(clip_id)
    if not clip or not clip.get("thumbnail_path"):
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    thumb_path = Path(clip["thumbnail_path"])
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file on disk not found")

    return FileResponse(path=str(thumb_path), media_type="image/jpeg")


@app.get("/clips/{clip_id}")
def get_clip_details(clip_id: str):
    """Returns single clip details with live render status and edits."""
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    clip_dict = dict(clip)
    clip_dict["video_url"] = f"/clips/{clip_id}/video"
    clip_dict["thumbnail_url"] = f"/clips/{clip_id}/thumbnail" if clip_dict.get("thumbnail_path") else None
    clip_dict["proxy_url"] = f"/clips/{clip_id}/proxy"
    return clip_dict


@app.get("/clips/{clip_id}/proxy")
def stream_clip_proxy(clip_id: str):
    """
    Streams the low-resolution (480p) proxy video for fast and responsive in-editor scrubbing.
    Falls back to on-demand generation or the source video if proxy is missing.
    """
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    video_id = clip["video_id"]
    video_dir = DEFAULT_WORKDIR / video_id
    proxy_path = video_dir / "proxy.mp4"

    if not proxy_path.exists() or proxy_path.stat().st_size == 0:
        # Search for source video to generate proxy on-demand
        source_candidates = [video_dir / "source.mp4", video_dir / "source.mkv", video_dir / "source.webm"]
        source_path = next((c for c in source_candidates if c.exists()), None)
        if not source_path:
            raise HTTPException(status_code=404, detail="Source video not found on disk")
        try:
            generate_proxy_video(source_path, proxy_path)
        except Exception as e:
            logger.warning(f"On-demand proxy generation failed, falling back to source video: {e}")
            return FileResponse(path=str(source_path), media_type="video/mp4")

    return FileResponse(
        path=str(proxy_path),
        media_type="video/mp4",
        filename=f"proxy_{video_id}.mp4",
    )


def _background_calculate_crop_path(video_path: Path, start: float, end: float, cache_file: Path):
    try:
        from clipzilla.reframe import get_speaker_crop_path
        computed = get_speaker_crop_path(video_path, start, end, sample_interval=1.0)
        if computed:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(computed, f)
    except Exception as e:
        logger.debug(f"Background crop calculation skipped: {e}")


@app.get("/clips/{clip_id}/editor-data")
def get_clip_editor_data(clip_id: str, background_tasks: BackgroundTasks):
    """
    Provides all data required by the React timeline editor:
    - Clip boundaries and metadata
    - 480p proxy stream URL
    - Word/line caption blocks within the clip timeframe
    - Detected speaker crop path across the clip (cached / fast non-blocking)
    - Existing saved edits and re-render status
    """
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    video_id = clip["video_id"]
    video_dir = DEFAULT_WORKDIR / video_id
    transcript_file = video_dir / "transcript.json"

    edits = clip.get("edits") or {}
    start_time = float(edits.get("trim_start", clip["start_time"]))
    end_time = float(edits.get("trim_end", clip["end_time"]))

    # 1. Extract captions (either existing user edits or transcript lines)
    saved_captions = edits.get("captions")
    if saved_captions:
        captions = saved_captions
    elif transcript_file.exists():
        try:
            with open(transcript_file, "r", encoding="utf-8") as f:
                tdata = json.load(f)
            words = []
            for seg in tdata.get("segments", []):
                for w in seg.get("words", []):
                    if w["end"] >= clip["start_time"] - 0.2 and w["start"] <= clip["end_time"] + 0.2:
                        words.append(w)
            phrases = group_words_into_phrases(words, max_words_per_phrase=4)
            captions = []
            for idx, p in enumerate(phrases):
                captions.append({
                    "id": f"cap_{idx}",
                    "start": round(p[0]["start"], 2),
                    "end": round(p[-1]["end"], 2),
                    "text": " ".join(w["word"].strip() for w in p),
                })
        except Exception as e:
            logger.warning(f"Error parsing transcript for editor: {e}")
            captions = []
    else:
        captions = []

    # 2. Extract speaker crop path from cache or queue non-blocking background task
    crop_cache = video_dir / f"crop_{clip_id}.json"
    crop_path = []

    saved_crop_path = edits.get("crop_path")
    if saved_crop_path:
        crop_path = saved_crop_path
    elif crop_cache.exists():
        try:
            with open(crop_cache, "r", encoding="utf-8") as f:
                crop_path = json.load(f)
        except Exception:
            crop_path = []

    if not crop_path:
        # Instant non-blocking default anchor points
        crop_path = [
            {"time": 0.0, "center_x": 0.5, "confidence": 1.0},
            {"time": round(end_time - start_time, 2), "center_x": 0.5, "confidence": 1.0},
        ]
        # Queue background calculation on proxy video without delaying initial editor load
        proxy_path = video_dir / "proxy.mp4"
        calc_video = proxy_path if (proxy_path.exists() and proxy_path.stat().st_size > 0) else None
        if not calc_video:
            source_candidates = [video_dir / "source.mp4", video_dir / "source.mkv", video_dir / "source.webm"]
            calc_video = next((c for c in source_candidates if c.exists()), None)
        if calc_video:
            background_tasks.add_task(
                _background_calculate_crop_path,
                calc_video,
                clip["start_time"],
                clip["end_time"],
                crop_cache,
            )

    clip_dict = dict(clip)
    clip_dict["video_url"] = f"/clips/{clip_id}/video"
    clip_dict["thumbnail_url"] = f"/clips/{clip_id}/thumbnail" if clip.get("thumbnail_path") else None
    clip_dict["proxy_url"] = f"/clips/{clip_id}/proxy"

    return {
        "clip": clip_dict,
        "proxy_url": f"/clips/{clip_id}/proxy",
        "video_url": f"/clips/{clip_id}/video",
        "captions": captions,
        "crop_path": crop_path,
        "edits": edits,
        "render_status": clip.get("render_status", "idle"),
        "render_error": clip.get("render_error"),
    }


@app.post("/clips/{clip_id}/edits")
def save_clip_edits(clip_id: str, req: ClipEditsRequest):
    """Saves user edit draft (trim bounds, caption overrides, crop overrides, styles) to SQLite."""
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    payload = req.model_dump(exclude_unset=True)
    update_clip_edits(clip_id, payload)
    return {"status": "saved", "clip_id": clip_id, "edits": payload}


@app.post("/clips/{clip_id}/rerender")
def trigger_clip_rerender(clip_id: str, req: Optional[ClipEditsRequest] = None):
    """
    Triggers an isolated re-render of this single short using the full-res source.
    Re-crops, re-captions, and re-exports without re-running transcript/analysis.
    """
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    if req:
        payload = req.model_dump(exclude_unset=True)
        if payload:
            update_clip_edits(clip_id, payload)

    enqueue_rerender(clip_id)
    return {"status": "rendering", "clip_id": clip_id}



@app.get("/presets")
def list_presets():
    """Returns all available export presets and their specifications."""
    return EXPORT_PRESETS


@app.get("/batches/{batch_id}")
def get_batch_status(batch_id: str):
    """Returns the live status of all jobs belonging to a batch."""
    jobs = get_jobs_by_batch(batch_id)
    if not jobs:
        raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")

    total = len(jobs)
    done = sum(1 for j in jobs if j["status"] == "done")
    failed = sum(1 for j in jobs if j["status"] == "failed")
    in_progress = sum(1 for j in jobs if j["status"] in ("downloading", "transcribing", "analyzing", "rendering"))

    return {
        "batch_id": batch_id,
        "total": total,
        "done": done,
        "failed": failed,
        "in_progress": in_progress,
        "is_complete": (done + failed) == total,
        "jobs": jobs,
    }


@app.get("/batches/{batch_id}/clips")
def get_batch_clips(batch_id: str):
    """Returns all clips across all jobs in a batch, with source video details."""
    clips = get_clips_by_batch(batch_id)
    results = []
    for c in clips:
        clip_dict = dict(c)
        clip_id = clip_dict["id"]
        clip_dict["video_url"] = f"/clips/{clip_id}/video"
        clip_dict["thumbnail_url"] = f"/clips/{clip_id}/thumbnail" if clip_dict.get("thumbnail_path") else None
        results.append(clip_dict)
    return results


@app.get("/history")
def get_history(limit: int = 100):
    """Returns past jobs with aggregated clip counts and source details."""
    return get_project_history(limit=limit)


@app.delete("/jobs/{job_id}")
def remove_job(job_id: str):
    """Deletes a job and associated clips from history."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    delete_job(job_id)
    return {"status": "deleted", "job_id": job_id}


@app.delete("/history/failed")
def clear_failed_history():
    """Deletes all failed jobs and their associated clips from history."""
    deleted_count = delete_failed_jobs()
    return {"status": "cleared", "deleted_count": deleted_count}


@app.delete("/clips/{clip_id}")
def remove_clip(clip_id: str):
    """Deletes a single clip from the database."""
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    delete_clip(clip_id)
    return {"status": "deleted", "clip_id": clip_id}


@app.get("/settings")
def read_settings():
    """Reads LLM configuration safely (without exposing raw secret keys)."""
    return get_safe_settings()


@app.post("/settings")
def write_settings(req: SettingsUpdateRequest):
    """Updates active LLM provider and saves credentials to config.yaml and .env."""
    updated = update_settings(req.model_dump(exclude_unset=True))
    return updated


@app.get("/settings/profiles")
def list_profiles():
    """Returns all configured named provider profiles."""
    return get_safe_profiles()


@app.post("/settings/profiles")
def add_or_update_profile(req: ProfileCreateOrUpdateRequest):
    """Adds a new named provider profile or updates an existing one."""
    try:
        return save_profile(req.model_dump(exclude_unset=True))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/settings/profiles/{profile_id}")
def remove_profile(profile_id: str):
    """Deletes a named provider profile."""
    try:
        return delete_profile(profile_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/settings/active-profile")
def switch_active_profile(req: ActiveProfileRequest):
    """Switches the active default profile."""
    try:
        return set_active_profile(req.profile_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Optional: Mount production frontend if dist directory exists
dist_dir = Path(__file__).resolve().parent.parent.parent.parent / "web" / "dist"
if dist_dir.exists():
    from fastapi.staticfiles import StaticFiles

    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    def serve_frontend_index():
        return FileResponse(dist_dir / "index.html")


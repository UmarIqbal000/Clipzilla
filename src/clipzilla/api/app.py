import os
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
from clipzilla.api.database import (
    create_social_account,
    get_social_account,
    list_social_accounts,
    update_social_account,
    delete_social_account,
    create_publish_job,
    get_publish_job,
    list_publish_jobs_for_clip,
    update_publish_job_status,
)
from clipzilla.api.credentials import encrypt_credentials, decrypt_credentials
from clipzilla.api.publishers import get_publisher, PUBLISHER_REGISTRY
from clipzilla.api.publish_worker import start_publish_worker, enqueue_publish

logger = logging.getLogger("clipzilla.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and worker threads on startup
    init_db()
    start_worker()
    start_publish_worker()
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


class OAuthCompleteRequest(BaseModel):
    code: str = Field(..., description="OAuth authorization code from the callback")
    redirect_uri: str = Field(..., description="The redirect URI used in the OAuth flow")


class PublishRequest(BaseModel):
    account_ids: List[str] = Field(..., min_length=1, description="List of social account IDs to publish to")
    title: Optional[str] = Field(None, description="Post title / caption")
    description: Optional[str] = Field(None, description="Post description")
    tags: Optional[str] = Field(None, description="Comma-separated hashtags")
    privacy: Optional[str] = Field("public", description="'public', 'private', or 'unlisted'")
    scheduled_at: Optional[str] = Field(None, description="ISO 8601 datetime for scheduled publish, or null for immediate")


class AccountUpdateRequest(BaseModel):
    account_name: Optional[str] = None
    is_active: Optional[bool] = None


class PlatformCredentialsRequest(BaseModel):
    youtube_client_id: Optional[str] = None
    youtube_client_secret: Optional[str] = None
    meta_app_id: Optional[str] = None
    meta_app_secret: Optional[str] = None
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_s3_bucket: Optional[str] = None
    aws_s3_region: Optional[str] = None


class DirectConnectRequest(BaseModel):
    platform: str = Field(..., description="'youtube', 'instagram', or 'facebook'")
    account_name: str = Field(..., min_length=1)
    account_handle: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    page_id: Optional[str] = None
    page_access_token: Optional[str] = None
    ig_user_id: Optional[str] = None
    expires_in: Optional[int] = None



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


@app.post("/jobs/{job_id}/retry")
def retry_job(job_id: str):
    """Re-enqueues a failed job for processing."""
    from clipzilla.api.database import update_job_status
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    update_job_status(job_id, status="queued", progress=0, stage_message="Re-queued for processing...", error_message=None)
    enqueue_job(job_id)
    return {"status": "re-queued", "job_id": job_id}


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



# ──────────────────────────────────────────────────────────────────────────────
# Social Accounts & Publishing
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/social-accounts")
def get_all_social_accounts(platform: Optional[str] = None):
    """Lists all connected social media accounts, optionally filtered by platform."""
    accounts = list_social_accounts(platform=platform)
    # Strip encrypted credentials from response
    safe = []
    for a in accounts:
        acc = dict(a) if not isinstance(a, dict) else a.copy()
        acc.pop("credentials", None)
        safe.append(acc)
    return safe


@app.get("/social-accounts/{account_id}")
def get_social_account_details(account_id: str):
    """Returns details of a single connected social account (without raw credentials)."""
    account = get_social_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Social account not found")
    acc = dict(account) if not isinstance(account, dict) else account.copy()
    acc.pop("credentials", None)
    return acc


@app.patch("/social-accounts/{account_id}")
def patch_social_account(account_id: str, req: AccountUpdateRequest):
    """Updates an account's name or active status."""
    account = get_social_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Social account not found")
    updates = req.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_social_account(account_id, **updates)
    return {"status": "updated", "account_id": account_id}


@app.delete("/social-accounts/{account_id}")
def remove_social_account(account_id: str):
    """Disconnects and removes a social media account."""
    account = get_social_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Social account not found")
    delete_social_account(account_id)
    return {"status": "deleted", "account_id": account_id}


@app.get("/social-accounts/credentials/status")
def get_credentials_status():
    """Returns whether platform credentials (client IDs/secrets, S3 keys) are configured on the dashboard."""
    from clipzilla.api.settings import ENV_PATH
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=ENV_PATH, override=True)

    yt_id = os.getenv("YOUTUBE_CLIENT_ID", "")
    yt_sec = os.getenv("YOUTUBE_CLIENT_SECRET", "")
    meta_id = os.getenv("META_APP_ID", "")
    meta_sec = os.getenv("META_APP_SECRET", "")
    aws_key = os.getenv("AWS_ACCESS_KEY_ID", "")
    aws_sec = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    s3_bucket = os.getenv("CLIPZILLA_S3_BUCKET") or os.getenv("AWS_S3_BUCKET", "")
    s3_region = os.getenv("CLIPZILLA_S3_REGION") or os.getenv("AWS_DEFAULT_REGION") or os.getenv("AWS_REGION", "us-east-1")

    def mask_str(s: str, visible_start: int = 4, visible_end: int = 4) -> str:
        if not s:
            return ""
        if len(s) <= visible_start + visible_end:
            return s[:2] + "..." + s[-2:] if len(s) >= 4 else "***"
        return f"{s[:visible_start]}...{s[-visible_end:]}"

    return {
        "youtube": {
            "has_credentials": bool(yt_id and yt_sec),
            "has_client_id": bool(yt_id),
            "has_client_secret": bool(yt_sec),
            "client_id_preview": mask_str(yt_id, 8, 4) if yt_id else "",
        },
        "meta": {
            "has_credentials": bool(meta_id and meta_sec),
            "has_app_id": bool(meta_id),
            "has_app_secret": bool(meta_sec),
            "app_id_preview": mask_str(meta_id, 4, 4) if meta_id else "",
        },
        "aws": {
            "has_credentials": bool(aws_key and aws_sec and s3_bucket),
            "has_access_key": bool(aws_key),
            "has_secret_key": bool(aws_sec),
            "access_key_preview": mask_str(aws_key, 4, 4) if aws_key else "",
            "s3_bucket": s3_bucket,
            "s3_region": s3_region,
        }
    }


@app.post("/social-accounts/credentials")
def save_platform_credentials(req: PlatformCredentialsRequest):
    """Saves platform API credentials and AWS S3 configuration from the dashboard directly into .env."""
    from clipzilla.api.settings import ENV_PATH
    from dotenv import set_key, load_dotenv
    if not ENV_PATH.exists():
        ENV_PATH.touch()

    mapping = {
        "YOUTUBE_CLIENT_ID": req.youtube_client_id,
        "YOUTUBE_CLIENT_SECRET": req.youtube_client_secret,
        "META_APP_ID": req.meta_app_id,
        "META_APP_SECRET": req.meta_app_secret,
        "AWS_ACCESS_KEY_ID": req.aws_access_key_id,
        "AWS_SECRET_ACCESS_KEY": req.aws_secret_access_key,
        "CLIPZILLA_S3_BUCKET": req.aws_s3_bucket,
        "CLIPZILLA_S3_REGION": req.aws_s3_region,
    }

    updated = []
    for env_key, val in mapping.items():
        if val is not None and val.strip() != "":
            set_key(str(ENV_PATH), env_key, val.strip())
            os.environ[env_key] = val.strip()
            updated.append(env_key)

    load_dotenv(dotenv_path=ENV_PATH, override=True)
    return {"status": "saved", "updated": updated}


@app.post("/social-accounts/direct-connect")
def direct_connect_account(req: DirectConnectRequest):
    """Allows directly adding an account using tokens/keys entered on the dashboard."""
    platform = req.platform.lower()
    if platform not in PUBLISHER_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    creds_dict = {}
    if req.access_token:
        creds_dict["access_token"] = req.access_token.strip()
    if req.refresh_token:
        creds_dict["refresh_token"] = req.refresh_token.strip()
    if req.page_id:
        creds_dict["page_id"] = req.page_id.strip()
    if req.page_access_token:
        creds_dict["page_access_token"] = req.page_access_token.strip()
    if req.ig_user_id:
        creds_dict["ig_user_id"] = req.ig_user_id.strip()

    if not creds_dict:
        raise HTTPException(status_code=400, detail="At least one token or credential key must be provided.")

    if platform == "youtube":
        if not creds_dict.get("access_token") and not creds_dict.get("refresh_token"):
            raise HTTPException(status_code=400, detail="YouTube requires access_token or refresh_token.")
    elif platform == "instagram":
        if not creds_dict.get("access_token") or not creds_dict.get("ig_user_id"):
            raise HTTPException(status_code=400, detail="Instagram requires both access_token and ig_user_id.")
    elif platform == "facebook":
        if not creds_dict.get("page_id") or not (creds_dict.get("page_access_token") or creds_dict.get("access_token")):
            raise HTTPException(status_code=400, detail="Facebook requires page_id and page_access_token.")
        if not creds_dict.get("page_access_token"):
            creds_dict["page_access_token"] = creds_dict["access_token"]

    encrypted = encrypt_credentials(creds_dict)
    account_id = str(uuid.uuid4())
    token_expires_at = None
    if req.expires_in:
        from datetime import datetime, timedelta
        token_expires_at = (datetime.utcnow() + timedelta(seconds=int(req.expires_in))).isoformat()

    create_social_account(
        account_id=account_id,
        platform=platform,
        account_name=req.account_name,
        account_handle=req.account_handle or req.account_name.lower().replace(" ", "_"),
        credentials=encrypted,
        token_expires_at=token_expires_at,
    )

    return {
        "status": "connected",
        "account_id": account_id,
        "platform": platform,
        "account_name": req.account_name,
    }


@app.get("/social-accounts/oauth/{platform}/start")
@app.post("/social-accounts/oauth/{platform}/start")
def start_oauth_flow(platform: str):
    """Starts the OAuth flow for a platform. Returns the authorization URL to open in the browser."""
    if platform not in PUBLISHER_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    publisher = get_publisher(platform)
    # Generate a unique state token for CSRF protection
    state = uuid.uuid4().hex
    # Default redirect URI for the local OAuth callback
    redirect_uri = "http://localhost:8000/social-accounts/oauth/callback"

    try:
        auth_url = publisher.get_oauth_url(redirect_uri=redirect_uri, state=state)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to generate OAuth URL for {platform}: {e}")
        raise HTTPException(status_code=500, detail=f"OAuth setup failed: {str(e)}")

    return {
        "auth_url": auth_url,
        "url": auth_url,
        "state": state,
        "redirect_uri": redirect_uri,
        "platform": platform,
    }


@app.get("/social-accounts/oauth/callback")
def oauth_callback(code: str, state: Optional[str] = None):
    """OAuth redirect callback. Renders a simple HTML page that sends the code to the opener window."""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><title>Clipzilla - Authorization Complete</title></head>
    <body style="font-family: sans-serif; text-align: center; padding: 60px;">
        <h2>✅ Authorization Successful</h2>
        <p>You can close this tab and return to Clipzilla.</p>
        <script>
            if (window.opener) {{
                window.opener.postMessage({{
                    type: 'CLIPZILLA_OAUTH_CALLBACK',
                    code: '{code}',
                    state: '{state or ""}'
                }}, '*');
                setTimeout(() => window.close(), 2000);
            }}
        </script>
    </body>
    </html>
    """
    return JSONResponse(content=html, media_type="text/html")


@app.post("/social-accounts/oauth/{platform}/complete")
def complete_oauth_flow(platform: str, req: OAuthCompleteRequest):
    """Exchanges the OAuth auth code for tokens and creates the social account."""
    if platform not in PUBLISHER_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    publisher = get_publisher(platform)

    try:
        result = publisher.complete_oauth(auth_code=req.code, redirect_uri=req.redirect_uri)
    except Exception as e:
        logger.error(f"OAuth completion failed for {platform}: {e}")
        raise HTTPException(status_code=400, detail=f"OAuth failed: {str(e)}")

    # Encrypt sensitive tokens before storing
    creds_to_store = {
        k: v for k, v in result.items()
        if k in ("access_token", "refresh_token", "expires_in", "client_id", "client_secret",
                 "page_id", "page_access_token", "ig_user_id", "token_type")
    }
    encrypted = encrypt_credentials(creds_to_store)

    account_id = str(uuid.uuid4())
    token_expires_at = None
    if result.get("expires_in"):
        from datetime import datetime, timedelta
        token_expires_at = (datetime.utcnow() + timedelta(seconds=int(result["expires_in"]))).isoformat()

    create_social_account(
        account_id=account_id,
        platform=platform,
        account_name=result.get("account_name", f"{platform.title()} Account"),
        account_handle=result.get("account_handle"),
        credentials=encrypted,
        scopes=result.get("scopes"),
        token_expires_at=token_expires_at,
        account_avatar_url=result.get("avatar_url"),
    )

    return {
        "status": "connected",
        "account_id": account_id,
        "platform": platform,
        "account_name": result.get("account_name"),
        "account_handle": result.get("account_handle"),
    }


@app.post("/clips/{clip_id}/publish")
def publish_clip(clip_id: str, req: PublishRequest):
    """Publishes a clip to one or more social media platforms.

    Creates a publish job for each selected account and enqueues them
    for background processing by the publish worker.
    """
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    created_jobs = []
    for account_id in req.account_ids:
        account = get_social_account(account_id)
        if not account:
            raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
        if not (account.get("is_active") if isinstance(account, dict) else account["is_active"]):
            raise HTTPException(status_code=400, detail=f"Account {account_id} is inactive")

        pub_job_id = str(uuid.uuid4())
        platform = account["platform"] if isinstance(account, dict) else account["platform"]

        # Use clip title as default if not provided
        title = req.title or clip.get("title", "")
        description = req.description or clip.get("reason", "")

        create_publish_job(
            job_id=pub_job_id,
            clip_id=clip_id,
            account_id=account_id,
            platform=platform,
            title=title,
            description=description,
            tags=req.tags,
            privacy=req.privacy or "public",
            scheduled_at=req.scheduled_at,
        )

        # Enqueue for immediate processing (unless scheduled)
        if not req.scheduled_at:
            enqueue_publish(pub_job_id)

        created_jobs.append({
            "publish_job_id": pub_job_id,
            "platform": platform,
            "account_name": account.get("account_name") if isinstance(account, dict) else account["account_name"],
            "status": "queued" if not req.scheduled_at else "scheduled",
        })

    job_ids = [j["publish_job_id"] for j in created_jobs]
    return {
        "clip_id": clip_id,
        "publish_jobs": created_jobs,
        "job_ids": job_ids,
        "count": len(created_jobs),
    }


@app.get("/clips/{clip_id}/publish-history")
def get_clip_publish_history(clip_id: str):
    """Returns the publish history for a clip across all platforms."""
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    jobs = list_publish_jobs_for_clip(clip_id)
    results = []
    for j in jobs:
        job_dict = dict(j) if not isinstance(j, dict) else j.copy()
        job_dict["post_url"] = job_dict.get("platform_post_url")
        job_dict["post_id"] = job_dict.get("platform_post_id")
        # Attach account info
        account = get_social_account(job_dict["account_id"])
        if account:
            acc = dict(account) if not isinstance(account, dict) else account
            job_dict["account_name"] = acc.get("account_name")
            job_dict["account_handle"] = acc.get("account_handle")
        results.append(job_dict)
    return results


@app.get("/publish-jobs/{job_id}")
def get_publish_job_status(job_id: str):
    """Returns the status of a publish job."""
    job = get_publish_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Publish job not found")
    job_dict = dict(job) if not isinstance(job, dict) else job.copy()
    job_dict["post_url"] = job_dict.get("platform_post_url")
    job_dict["post_id"] = job_dict.get("platform_post_id")
    # Attach account info
    account = get_social_account(job_dict["account_id"])
    if account:
        acc = dict(account) if not isinstance(account, dict) else account
        job_dict["account_name"] = acc.get("account_name")
        job_dict["account_handle"] = acc.get("account_handle")
    return job_dict


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

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        candidate = dist_dir / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(dist_dir / "index.html")


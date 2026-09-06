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
from clipzilla.downloader import generate_proxy_video
from clipzilla.reframe import get_speaker_crop_path
from clipzilla.subtitles import group_words_into_phrases
from clipzilla.api.database import (
    init_db,
    create_job,
    get_job,
    list_jobs,
    get_clips_for_job,
    get_clip,
    update_clip_edits,
    update_clip_render_status,
)
from clipzilla.api.worker import enqueue_job, start_worker, enqueue_rerender
from clipzilla.api.settings import get_safe_settings, update_settings

logger = logging.getLogger("clipzilla.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and worker thread on startup
    init_db()
    start_worker()
    yield


app = FastAPI(
    title="Clipzilla API",
    description="Local web API for Clipzilla — monster that devours long-form and spits out shorts.",
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
    url: str = Field(..., min_length=5, description="YouTube video URL")
    preset: Optional[str] = Field("karaoke", description="Subtitle animation preset ('karaoke' or 'single')")
    reframe: Optional[str] = Field("auto", description="Reframing strategy ('auto', 'face', 'blur', 'center')")


class SettingsUpdateRequest(BaseModel):
    provider: Optional[str] = None
    providers: Optional[Dict[str, Dict[str, Any]]] = None


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
    """Submits a YouTube URL to be converted into shorts in the background."""
    job_id = str(uuid.uuid4())
    job = create_job(
        job_id=job_id,
        url=req.url.strip(),
        preset=req.preset or "karaoke",
        reframe=req.reframe or "auto",
    )
    enqueue_job(job_id)
    return {
        "id": job["id"],
        "url": job["url"],
        "status": job["status"],
        "progress": job["progress"],
        "stage_message": job["stage_message"],
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


@app.get("/clips/{clip_id}/editor-data")
def get_clip_editor_data(clip_id: str):
    """
    Provides all data required by the React timeline editor:
    - Clip boundaries and metadata
    - 480p proxy stream URL
    - Word/line caption blocks within the clip timeframe
    - Detected speaker crop path across the clip
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

    # 2. Extract speaker crop path from source video
    source_candidates = [video_dir / "source.mp4", video_dir / "source.mkv", video_dir / "source.webm"]
    source_path = next((c for c in source_candidates if c.exists()), None)
    crop_path = []
    if source_path:
        try:
            crop_path = get_speaker_crop_path(source_path, clip["start_time"], clip["end_time"])
        except Exception as e:
            logger.warning(f"Error calculating crop path: {e}")

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



@app.get("/settings")
def read_settings():
    """Reads LLM configuration safely (without exposing raw secret keys)."""
    return get_safe_settings()


@app.post("/settings")
def write_settings(req: SettingsUpdateRequest):
    """Updates active LLM provider and saves credentials to config.yaml and .env."""
    updated = update_settings(req.model_dump(exclude_unset=True))
    return updated

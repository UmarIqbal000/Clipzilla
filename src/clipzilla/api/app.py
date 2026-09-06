import uuid
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from clipzilla.api.database import (
    init_db,
    create_job,
    get_job,
    list_jobs,
    get_clips_for_job,
    get_clip,
)
from clipzilla.api.worker import enqueue_job, start_worker
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


@app.get("/settings")
def read_settings():
    """Reads LLM configuration safely (without exposing raw secret keys)."""
    return get_safe_settings()


@app.post("/settings")
def write_settings(req: SettingsUpdateRequest):
    """Updates active LLM provider and saves credentials to config.yaml and .env."""
    updated = update_settings(req.model_dump(exclude_unset=True))
    return updated

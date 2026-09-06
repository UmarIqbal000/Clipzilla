from pathlib import Path
import json
import logging
import yt_dlp

from clipzilla.config import DEFAULT_WORKDIR

logger = logging.getLogger("clipzilla.downloader")


def download_video(url: str, workdir: Path = DEFAULT_WORKDIR) -> dict:
    """
    Downloads a YouTube video capped at 1080p with audio and captions (manual + auto).
    Saves everything to workdir/<video_id>/
    """
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    # 1. Fetch metadata first to get video_id
    extract_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
    }
    with yt_dlp.YoutubeDL(extract_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if not info:
            raise ValueError(f"Could not retrieve video information for {url}")
        video_id = info.get("id")
        if not video_id:
            raise ValueError(f"No video ID found in metadata for {url}")

    video_dir = workdir / video_id
    video_dir.mkdir(parents=True, exist_ok=True)

    output_template = str(video_dir / "source.%(ext)s")

    # 2. Configure download options capped at 1080p with captions
    ydl_opts = {
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
        "outtmpl": output_template,
        "merge_output_format": "mp4",
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": ["en", "en-US", "en-GB", "en-orig", "en.*"],
        "subtitlesformat": "vtt/srt/best",
        "no_warnings": True,
    }

    logger.info(f"Downloading video '{info.get('title')}' ({video_id}) capped at 1080p...")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    # 3. Locate final video file
    video_file = None
    for candidate in [video_dir / "source.mp4", video_dir / "source.mkv", video_dir / "source.webm"]:
        if candidate.exists() and candidate.stat().st_size > 0:
            video_file = candidate
            break

    if not video_file:
        # Fallback: search for any mp4/mkv/webm in video_dir
        media_files = [f for f in video_dir.iterdir() if f.suffix.lower() in [".mp4", ".mkv", ".webm"]]
        if media_files:
            video_file = max(media_files, key=lambda f: f.stat().st_size)
        else:
            raise FileNotFoundError(f"Failed to locate downloaded video file in {video_dir}")

    # 4. Locate caption files
    caption_files = [
        f for f in video_dir.iterdir()
        if f.suffix.lower() in [".vtt", ".srt"] and f.name.startswith("source.")
    ]

    # 5. Save metadata
    metadata = {
        "id": video_id,
        "title": info.get("title"),
        "duration": info.get("duration"),
        "uploader": info.get("uploader"),
        "channel": info.get("channel"),
        "channel_id": info.get("channel_id"),
        "view_count": info.get("view_count"),
        "webpage_url": info.get("webpage_url", url),
        "video_path": str(video_file.relative_to(workdir.parent if workdir.is_absolute() else Path.cwd())),
        "caption_files": [str(c.name) for c in caption_files],
    }

    metadata_path = video_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return {
        "video_id": video_id,
        "video_dir": video_dir,
        "video_path": video_file,
        "metadata_path": metadata_path,
        "caption_files": caption_files,
        "metadata": metadata,
    }

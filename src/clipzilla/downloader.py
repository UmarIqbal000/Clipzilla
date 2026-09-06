from pathlib import Path
import json
import logging
import subprocess
import yt_dlp

from clipzilla.config import DEFAULT_WORKDIR

logger = logging.getLogger("clipzilla.downloader")


def generate_proxy_video(video_path: Path, output_proxy_path: Path) -> Path:
    """
    Generates a low-resolution (480p) proxy video for responsive in-editor scrubbing.
    Uses ultrafast x264 preset and faststart flags.
    """
    video_path = Path(video_path).resolve()
    output_proxy_path = Path(output_proxy_path).resolve()
    output_proxy_path.parent.mkdir(parents=True, exist_ok=True)

    if output_proxy_path.exists() and output_proxy_path.stat().st_size > 1024:
        return output_proxy_path

    temp_proxy = output_proxy_path.with_name(f"{output_proxy_path.stem}.tmp.mp4")
    if temp_proxy.exists():
        try:
            temp_proxy.unlink()
        except Exception:
            pass

    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(video_path),
        "-vf", "scale=-2:480",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "28",
        "-c:a", "aac",
        "-b:a", "96k",
        "-movflags", "+faststart",
        str(temp_proxy),
    ]
    logger.info(f"Generating 480p scrubbing proxy for {video_path.name} -> {output_proxy_path.name}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        logger.warning(f"Failed to generate proxy video: {res.stderr[-300:]}")
        raise RuntimeError(f"FFmpeg proxy generation failed: {res.stderr[-300:]}")

    if not temp_proxy.exists() or temp_proxy.stat().st_size == 0:
        raise RuntimeError(f"Proxy generation failed to create valid output at {temp_proxy}")

    temp_proxy.replace(output_proxy_path)
    logger.info(f"480p proxy successfully created: {output_proxy_path.name} ({output_proxy_path.stat().st_size / 1024 / 1024:.2f} MB)")
    return output_proxy_path



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
        "subtitleslangs": ["en", "en-orig", "en-US", "en-GB"],
        "subtitlesformat": "vtt/srt/best",
        "no_warnings": True,
        "ignoreerrors": "only_download",
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

    # 5. Generate 480p proxy for fast scrubbing in editor
    proxy_path = video_dir / "proxy.mp4"
    try:
        generate_proxy_video(video_file, proxy_path)
    except Exception as e:
        logger.warning(f"Failed to generate proxy video during download: {e}")

    try:
        rel_video = str(video_file.resolve().relative_to(Path.cwd().resolve()))
    except Exception:
        rel_video = str(video_file)

    try:
        rel_proxy = str(proxy_path.resolve().relative_to(Path.cwd().resolve())) if proxy_path.exists() else None
    except Exception:
        rel_proxy = str(proxy_path) if proxy_path.exists() else None

    # 6. Save metadata
    metadata = {
        "id": video_id,
        "title": info.get("title"),
        "duration": info.get("duration"),
        "uploader": info.get("uploader"),
        "channel": info.get("channel"),
        "channel_id": info.get("channel_id"),
        "view_count": info.get("view_count"),
        "webpage_url": info.get("webpage_url", url),
        "video_path": rel_video,
        "proxy_path": rel_proxy,
        "caption_files": [str(c.name) for c in caption_files],
    }

    metadata_path = video_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return {
        "video_id": video_id,
        "video_dir": video_dir,
        "video_path": video_file,
        "proxy_path": proxy_path if proxy_path.exists() else None,
        "metadata_path": metadata_path,
        "caption_files": caption_files,
        "metadata": metadata,
    }

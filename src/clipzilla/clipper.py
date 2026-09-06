from pathlib import Path
import subprocess
import logging
from typing import Optional

from clipzilla.config import DEFAULT_WORKDIR, TARGET_WIDTH, TARGET_HEIGHT
from clipzilla.subtitles import generate_ass_subtitles

logger = logging.getLogger("clipzilla.clipper")


def cut_clip(
    video_dir: Path,
    start: float,
    end: float,
    output_path: Optional[Path] = None,
    transcript_path: Optional[Path] = None,
    burn_subtitles: bool = True,
) -> Path:
    """
    Cuts a segment from source video, crops and centers it to 1080x1920 vertical format,
    generates word-level ASS subtitles, and burns them in using FFmpeg subprocess streaming.
    Never loads video data into Python memory.
    """
    video_dir = Path(video_dir).resolve()
    if not video_dir.exists():
        raise FileNotFoundError(f"Video directory not found: {video_dir}")

    if start < 0 or end <= start:
        raise ValueError(f"Invalid clip bounds: start={start}, end={end}. Must satisfy 0 <= start < end.")

    duration = end - start

    # 1. Locate source video
    video_file = None
    for candidate in [video_dir / "source.mp4", video_dir / "source.mkv", video_dir / "source.webm"]:
        if candidate.exists():
            video_file = candidate
            break

    if not video_file:
        media_files = [
            f for f in video_dir.iterdir()
            if f.suffix.lower() in [".mp4", ".mkv", ".webm"] and not f.name.startswith("clip_")
        ]
        if media_files:
            video_file = media_files[0]
        else:
            raise FileNotFoundError(f"No source video file found in {video_dir}")

    # 2. Determine output path
    start_tag = f"{start:.2f}".replace(".", "_")
    end_tag = f"{end:.2f}".replace(".", "_")
    if not output_path:
        final_output_path = video_dir / f"clip_{start_tag}_{end_tag}.mp4"
    else:
        final_output_path = Path(output_path).resolve()
        final_output_path.parent.mkdir(parents=True, exist_ok=True)

    # 3. Handle subtitles
    ass_file_name = None
    if burn_subtitles:
        if not transcript_path:
            transcript_candidate = video_dir / "transcript.json"
        else:
            transcript_candidate = Path(transcript_path).resolve()

        if transcript_candidate.exists():
            ass_path = video_dir / f"subtitles_{start_tag}_{end_tag}.ass"
            generate_ass_subtitles(
                transcript=transcript_candidate,
                clip_start=start,
                clip_end=end,
                output_ass_path=ass_path,
            )
            ass_file_name = ass_path.name
        else:
            logger.warning(f"No transcript found at {transcript_candidate}. Proceeding without subtitles.")

    # 4. Construct FFmpeg filtergraph
    # Center crop to vertical 1080x1920 (9:16)
    base_filter = (
        f"scale={TARGET_WIDTH}:{TARGET_HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={TARGET_WIDTH}:{TARGET_HEIGHT}:(in_w-{TARGET_WIDTH})/2:(in_h-{TARGET_HEIGHT})/2"
    )

    if ass_file_name:
        # Use relative filename with cwd=video_dir to prevent Windows colon/backslash escaping issues
        filtergraph = f"{base_filter},ass={ass_file_name}"
    else:
        filtergraph = base_filter

    # 5. Execute FFmpeg streaming pipeline via subprocess
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(start),
        "-t", str(duration),
        "-i", video_file.name,
        "-vf", filtergraph,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-avoid_negative_ts", "make_zero",
        str(final_output_path.name if final_output_path.parent == video_dir else str(final_output_path)),
    ]

    logger.info(f"Running FFmpeg to cut {duration:.2f}s clip from {video_file.name}...")
    result = subprocess.run(
        cmd,
        cwd=str(video_dir),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(f"FFmpeg command failed with return code {result.returncode}:\n{result.stderr}")
        raise RuntimeError(f"FFmpeg failed (code {result.returncode}):\n{result.stderr[-500:]}")

    if not final_output_path.exists() or final_output_path.stat().st_size == 0:
        raise RuntimeError(f"FFmpeg succeeded but output file {final_output_path} is missing or empty.")

    logger.info(f"Short successfully generated: {final_output_path} ({final_output_path.stat().st_size / 1024 / 1024:.2f} MB)")
    return final_output_path

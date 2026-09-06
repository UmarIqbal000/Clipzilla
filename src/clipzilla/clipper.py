from pathlib import Path
import subprocess
import logging
import os
from typing import Optional, Union, Dict, Any, List

from clipzilla.config import DEFAULT_WORKDIR, TARGET_WIDTH, TARGET_HEIGHT
from clipzilla.subtitles import generate_ass_subtitles
from clipzilla.reframe import build_reframe_filter

logger = logging.getLogger("clipzilla.clipper")


def cut_clip(
    video_dir: Path,
    start: float,
    end: float,
    output_path: Optional[Path] = None,
    transcript_path: Optional[Path] = None,
    burn_subtitles: bool = True,
    reframe_mode: str = "auto",  # 'auto', 'face', 'blur', 'center'
    subtitle_preset: str = "karaoke",  # 'karaoke' or 'single'
    font_name: str = "Arial",
    highlight_color: str = "&H0000FFFF&",
    text_color: str = "&H00FFFFFF&",
    position: Union[str, int] = "bottom",
    overwrite: bool = False,
    crop_override: Optional[Dict[str, Any]] = None,
    caption_overrides: Optional[List[Dict[str, Any]]] = None,
) -> Path:
    """
    Cuts a segment from source video, reframes to 1080x1920 (using speaker face tracking,
    crop override, or blurred background fill), burns in animated ASS subtitles, and exports atomically.
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
            if f.suffix.lower() in [".mp4", ".mkv", ".webm"]
            and not f.name.startswith("clip_")
            and not f.name.endswith(".tmp.mp4")
            and not f.name.startswith("proxy.")
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

    # If output file already exists and is non-empty, resume/skip unless overwrite is True
    if not overwrite and final_output_path.exists() and final_output_path.stat().st_size > 1024:
        logger.info(f"Target clip already exists: {final_output_path.name}. Skipping.")
        return final_output_path

    temp_output_path = final_output_path.with_name(f"{final_output_path.stem}.tmp{final_output_path.suffix}")
    if temp_output_path.exists():
        try:
            temp_output_path.unlink()
        except Exception:
            pass

    # 3. Handle subtitles
    ass_file_name = None
    if burn_subtitles:
        if not transcript_path:
            transcript_candidate = video_dir / "transcript.json"
        else:
            transcript_candidate = Path(transcript_path).resolve()

        if caption_overrides or transcript_candidate.exists():
            ass_path = video_dir / f"subtitles_{start_tag}_{end_tag}.ass"
            generate_ass_subtitles(
                transcript=transcript_candidate if not caption_overrides else None,
                clip_start=start,
                clip_end=end,
                output_ass_path=ass_path,
                preset=subtitle_preset,
                font_name=font_name,
                highlight_color=highlight_color,
                text_color=text_color,
                margin_v=position,
                caption_overrides=caption_overrides,
            )
            ass_file_name = ass_path.name
        else:
            logger.warning(f"No transcript or captions found. Proceeding without subtitles.")

    # 4. Construct Reframe Filter
    logger.info(f"Reframing source video (mode='{reframe_mode}', override={crop_override is not None})...")
    base_filter, reframe_info = build_reframe_filter(
        video_path=video_file,
        start=start,
        end=end,
        mode=reframe_mode,
        target_w=TARGET_WIDTH,
        target_h=TARGET_HEIGHT,
        crop_override=crop_override,
    )
    logger.info(f"Selected reframing strategy: {reframe_info.get('strategy')}")

    # Combine reframe filter with ASS subtitle burning
    if "[bg]" in base_filter or "[fg]" in base_filter:
        # Complex filtergraph (e.g. blurred background fill)
        if ass_file_name:
            filtergraph = f"{base_filter};[v]ass={ass_file_name}[outv]"
            filter_args = ["-filter_complex", filtergraph, "-map", "[outv]", "-map", "0:a?"]
        else:
            filter_args = ["-filter_complex", base_filter, "-map", "[v]", "-map", "0:a?"]
    else:
        # Linear filterchain
        if ass_file_name:
            filtergraph = f"{base_filter},ass={ass_file_name}"
        else:
            filtergraph = base_filter
        filter_args = ["-vf", filtergraph]

    # 5. Execute FFmpeg streaming pipeline with atomic write
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(start),
        "-t", str(duration),
        "-i", video_file.name,
    ] + filter_args + [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-avoid_negative_ts", "make_zero",
        str(temp_output_path.name if temp_output_path.parent == video_dir else str(temp_output_path)),
    ]

    logger.info(f"Rendering short: {duration:.2f}s from {video_file.name} (preset={subtitle_preset})...")

    try:
        result = subprocess.run(
            cmd,
            cwd=str(video_dir),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            logger.error(f"FFmpeg failed with code {result.returncode}:\n{result.stderr[-600:]}")
            raise RuntimeError(f"FFmpeg failed (code {result.returncode}):\n{result.stderr[-600:]}")

        if not temp_output_path.exists() or temp_output_path.stat().st_size == 0:
            raise RuntimeError(f"FFmpeg completed but temp file {temp_output_path} is missing or empty.")

        # Atomic rename to prevent corrupt files on interruption
        os.replace(temp_output_path, final_output_path)
        logger.info(f"Short successfully created: {final_output_path.name} ({final_output_path.stat().st_size / 1024 / 1024:.2f} MB)")
        return final_output_path

    except Exception:
        if temp_output_path.exists():
            try:
                temp_output_path.unlink()
            except Exception:
                pass
        raise

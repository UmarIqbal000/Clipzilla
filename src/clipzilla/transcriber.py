from pathlib import Path
import json
import logging
from typing import Dict, Any, Optional

from faster_whisper import WhisperModel

from clipzilla.config import DEFAULT_MODELS_DIR, get_default_device, get_default_compute_type
from clipzilla.captions import convert_captions_to_transcript

logger = logging.getLogger("clipzilla.transcriber")


def find_caption_file(video_dir: Path) -> Optional[Path]:
    """Finds any suitable downloaded VTT or SRT caption file in the video folder."""
    # Priority: en vtt -> any vtt -> en srt -> any srt
    candidates = list(video_dir.glob("*.vtt")) + list(video_dir.glob("*.srt"))
    if not candidates:
        return None

    # Prefer English captions (prefer non-orig clean captions over rolling orig captions)
    en_candidates = [c for c in candidates if "en" in c.stem.lower()]
    if en_candidates:
        clean_en = [c for c in en_candidates if "orig" not in c.stem.lower()]
        if clean_en:
            return clean_en[0]
        return en_candidates[0]
    return candidates[0]


def transcribe_video(
    video_dir: Path,
    video_id: Optional[str] = None,
    force_whisper: bool = False,
    model_size: str = "base",
    device: Optional[str] = None,
    compute_type: Optional[str] = None,
    models_dir: Path = DEFAULT_MODELS_DIR,
) -> Dict[str, Any]:
    """
    Transcribes video audio to word-level timestamps.
    If YouTube captions exist and force_whisper is False, converts captions directly.
    Otherwise runs faster-whisper with CTranslate2 and int8 quantization.
    """
    video_dir = Path(video_dir)
    if not video_id:
        video_id = video_dir.name

    transcript_path = video_dir / "transcript.json"

    # 1. Check for existing captions first
    caption_file = find_caption_file(video_dir)
    if caption_file and not force_whisper:
        logger.info(f"Found YouTube captions: {caption_file.name}. Converting to transcript...")
        transcript = convert_captions_to_transcript(caption_file, video_id=video_id)
        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(transcript, f, indent=2, ensure_ascii=False)
        logger.info(f"Saved transcript from captions to {transcript_path}")
        return transcript

    # 2. Otherwise run faster-whisper
    # Locate audio / video source file
    video_file = None
    for candidate in [video_dir / "source.mp4", video_dir / "source.mkv", video_dir / "source.webm"]:
        if candidate.exists():
            video_file = candidate
            break

    if not video_file:
        media_files = [f for f in video_dir.iterdir() if f.suffix.lower() in [".mp4", ".mkv", ".webm", ".mp3", ".m4a", ".wav"]]
        if media_files:
            video_file = media_files[0]
        else:
            raise FileNotFoundError(f"No media file found to transcribe in {video_dir}")

    # Determine device and compute_type
    selected_device = device if device else get_default_device()
    selected_compute_type = compute_type if compute_type else get_default_compute_type(selected_device)

    logger.info(
        f"Running faster-whisper (model={model_size}, device={selected_device}, compute_type={selected_compute_type}) on {video_file.name}..."
    )

    models_dir = Path(models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    # Initialize model with automatic CPU fallback if CUDA fails
    try:
        model = WhisperModel(
            model_size_or_path=model_size,
            device=selected_device,
            compute_type=selected_compute_type,
            download_root=str(models_dir),
        )
        segments_generator, info = model.transcribe(
            str(video_file),
            word_timestamps=True,
            beam_size=5,
        )
        # Force evaluation of generator to ensure backend runs
        first_segment_check = None
        segments_list = []
        for seg in segments_generator:
            words = []
            if seg.words:
                for w in seg.words:
                    words.append({
                        "word": w.word.strip(),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                    })
            segments_list.append({
                "id": seg.id,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
                "words": words,
            })
    except Exception as e:
        if selected_device != "cpu":
            logger.warning(f"Failed to run Whisper on {selected_device} ({e}). Falling back to CPU with int8.")
            selected_device = "cpu"
            selected_compute_type = "int8"
            model = WhisperModel(
                model_size_or_path=model_size,
                device="cpu",
                compute_type="int8",
                download_root=str(models_dir),
            )
            segments_generator, info = model.transcribe(
                str(video_file),
                word_timestamps=True,
                beam_size=5,
            )
            segments_list = []
            for seg in segments_generator:
                words = []
                if seg.words:
                    for w in seg.words:
                        words.append({
                            "word": w.word.strip(),
                            "start": round(w.start, 3),
                            "end": round(w.end, 3),
                        })
                segments_list.append({
                    "id": seg.id,
                    "start": round(seg.start, 3),
                    "end": round(seg.end, 3),
                    "text": seg.text.strip(),
                    "words": words,
                })
        else:
            raise

    transcript = {
        "video_id": video_id,
        "source": "whisper",
        "language": info.language if info else "en",
        "segments": segments_list,
    }

    with open(transcript_path, "w", encoding="utf-8") as f:
        json.dump(transcript, f, indent=2, ensure_ascii=False)

    logger.info(f"Transcription complete. Saved {len(segments_list)} segments to {transcript_path}")
    return transcript

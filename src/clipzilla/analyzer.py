import json
import logging
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
import pydantic

from clipzilla.llm.base import LLMProvider
from clipzilla.schema import (
    SuggestedClip,
    SuggestedClipsResponse,
    validate_clip_timestamps,
)
from clipzilla.heuristics import apply_heuristics_to_clips

logger = logging.getLogger("clipzilla.analyzer")


def format_transcript_for_llm(transcript: Dict[str, Any], max_window_duration: float = 600.0) -> List[str]:
    """
    Formats the transcript segments into timestamped text chunks suitable for LLM analysis.
    Each entry is formatted as [MM:SS - MM:SS] text.
    """
    segments = transcript.get("segments", [])
    if not segments:
        return []

    chunks = []
    current_chunk_lines = []
    chunk_start = segments[0].get("start", 0.0)

    for seg in segments:
        s_start = seg.get("start", 0.0)
        s_end = seg.get("end", 0.0)
        text = seg.get("text", "").strip()
        if not text:
            continue

        start_min = int(s_start // 60)
        start_sec = int(s_start % 60)
        end_min = int(s_end // 60)
        end_sec = int(s_end % 60)

        line = f"[{start_min:02d}:{start_sec:02d} - {end_min:02d}:{end_sec:02d}] ({s_start:.2f}s - {s_end:.2f}s): {text}"
        current_chunk_lines.append(line)

        if (s_end - chunk_start) >= max_window_duration:
            chunks.append("\n".join(current_chunk_lines))
            current_chunk_lines = []
            chunk_start = s_end

    if current_chunk_lines:
        chunks.append("\n".join(current_chunk_lines))

    return chunks


def extract_json_from_text(text: str) -> Dict[str, Any]:
    """Extracts JSON object from LLM response text, stripping markdown fences if present."""
    text = text.strip()
    # Strip markdown code block if wrapped
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # Search for first { and last }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace : last_brace + 1]

    return json.loads(text)


def analyze_transcript(
    transcript: Dict[str, Any],
    provider: LLMProvider,
    model: Optional[str] = None,
    max_retries: int = 2,
) -> List[SuggestedClip]:
    """
    Analyzes transcript with an LLM to identify 3-8 self-contained, high-retention segments.
    Uses strict Pydantic validation with up to max_retries error-correction loops.
    """
    segments = transcript.get("segments", [])
    if not segments:
        raise ValueError("Transcript contains no segments to analyze.")

    total_duration = max((s.get("end", 0.0) for s in segments), default=0.0)
    formatted_transcript = "\n".join(format_transcript_for_llm(transcript))

    system_prompt = (
        "You are an expert short-form video editor specializing in YouTube Shorts, TikTok, and Instagram Reels.\n"
        "Your task is to analyze the video transcript with timestamps and identify between 3 to 8 self-contained, "
        "high-retention video clips that would perform exceptionally well as vertical shorts.\n\n"
        "CRITICAL REQUIREMENTS:\n"
        "1. Each clip MUST have a strong initial hook in the first 3-5 seconds.\n"
        "2. Each clip must be a complete, self-contained thought or story arc (no mid-sentence cutoffs).\n"
        "3. Ideal duration for each clip is between 15 and 60 seconds (minimum 5s, maximum 90s).\n"
        f"4. Timestamps (start_time and end_time) are in seconds as numbers, strictly between 0.0 and {total_duration:.2f}s.\n"
        "5. Respond ONLY with valid JSON strictly matching the following schema without any conversational text or markdown explanation:\n"
        "{\n"
        '  "clips": [\n'
        "    {\n"
        '      "start_time": float,\n'
        '      "end_time": float,\n'
        '      "title": "Catchy punchy title",\n'
        '      "reason": "One-line explanation of why this clip works and has high retention"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = (
        f"Here is the video transcript (Total duration: {total_duration:.2f} seconds):\n\n"
        f"{formatted_transcript}\n\n"
        "Identify 3 to 8 best short-form clips and output the JSON response now."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    last_error = None
    for attempt in range(max_retries + 1):
        logger.info(f"Querying LLM for clip suggestions (Attempt {attempt + 1}/{max_retries + 1})...")
        raw_response = provider.chat(messages, model=model)

        try:
            parsed_json = extract_json_from_text(raw_response)
            validated_response = SuggestedClipsResponse.model_validate(parsed_json)

            # Validate clip timestamps against video duration
            timestamp_errors = validate_clip_timestamps(validated_response.clips, total_duration)
            if timestamp_errors:
                raise ValueError("; ".join(timestamp_errors))

            # Apply sentence boundary heuristic check
            clips = apply_heuristics_to_clips(validated_response.clips, transcript)
            logger.info(f"Successfully identified {len(clips)} suggested clips.")
            return clips

        except (json.JSONDecodeError, pydantic.ValidationError, ValueError) as err:
            last_error = err
            logger.warning(f"Attempt {attempt + 1} validation failed: {err}")

            if attempt < max_retries:
                # Add error-correction prompt to message history
                messages.append({"role": "assistant", "content": raw_response})
                correction_prompt = (
                    f"Your previous response had validation errors:\n{err}\n\n"
                    f"Please correct the errors and output ONLY valid JSON strictly matching:\n"
                    '{"clips": [{"start_time": float, "end_time": float, "title": str, "reason": str}]}\n'
                    f"Ensure start_time and end_time are floating point seconds strictly between 0.0 and {total_duration:.2f}s."
                )
                messages.append({"role": "user", "content": correction_prompt})

    raise RuntimeError(
        f"Failed to generate valid clip suggestions after {max_retries + 1} attempts. Last error: {last_error}"
    )


def run_analysis_for_video(
    video_dir: Path,
    provider: Optional[LLMProvider] = None,
    model: Optional[str] = None,
    output_filename: str = "clips_suggested.json",
) -> Path:
    """
    Loads transcript from video directory, runs LLM analysis and heuristics,
    and saves output as clips_suggested.json in video_dir.
    """
    video_dir = Path(video_dir).resolve()
    transcript_path = video_dir / "transcript.json"

    if not transcript_path.exists():
        raise FileNotFoundError(
            f"No transcript found at {transcript_path}. Run 'clipzilla transcribe' on this video first."
        )

    with open(transcript_path, "r", encoding="utf-8") as f:
        transcript_data = json.load(f)

    if provider is None:
        from clipzilla.config import get_llm_provider
        provider = get_llm_provider(model_override=model)

    clips = analyze_transcript(transcript_data, provider=provider, model=model)

    output_path = video_dir / output_filename
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump([clip.model_dump() for clip in clips], f, indent=2, ensure_ascii=False)

    logger.info(f"Saved {len(clips)} suggested clips to {output_path}")
    return output_path

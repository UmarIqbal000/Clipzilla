import json
import logging
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
import pydantic

from clipzilla.llm.base import LLMProvider
from clipzilla.schema import (
    SuggestedClip,
    SuggestedClipsResponse,
    validate_clip_timestamps,
)
from clipzilla.presets import get_export_preset
from clipzilla.heuristics import apply_heuristics_to_clips

logger = logging.getLogger("clipzilla.analyzer")


def merge_segments_for_formatting(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Merges rapid, adjacent Whisper subtitle segments into natural thought blocks.
    Reduces redundant timestamp tokens by 50-70% while preserving exact audio boundaries.
    """
    merged = []
    curr_text = []
    curr_start = None
    curr_end = None

    for s in segments:
        text = s.get("text", "").strip()
        if not text:
            continue
        start = float(s.get("start", 0.0))
        end = float(s.get("end", 0.0))

        if curr_start is None:
            curr_start = start
            curr_end = end
            curr_text.append(text)
        else:
            gap = start - curr_end
            duration = end - curr_start
            ends_punct = curr_text[-1].endswith((".", "!", "?")) if curr_text else False
            # Merge if gap is short, duration is under 18s, and previous segment didn't end with terminal punctuation
            if gap < 1.5 and duration < 18.0 and not ends_punct:
                curr_text.append(text)
                curr_end = end
            else:
                merged.append({
                    "start": curr_start,
                    "end": curr_end,
                    "text": " ".join(curr_text),
                })
                curr_start = start
                curr_end = end
                curr_text = [text]

    if curr_text:
        merged.append({
            "start": curr_start,
            "end": curr_end,
            "text": " ".join(curr_text),
        })
    return merged


def format_transcript_for_llm(transcript: Dict[str, Any], max_window_duration: float = 600.0) -> List[str]:
    """
    Formats the transcript segments into timestamped text chunks suitable for LLM analysis.
    Each entry is formatted as [MM:SS - MM:SS] (s.start - s.end): text.
    """
    segments = transcript.get("segments", [])
    if not segments:
        return []

    merged_segs = merge_segments_for_formatting(segments)
    if not merged_segs:
        return []

    chunks = []
    current_chunk_lines = []
    chunk_start = merged_segs[0].get("start", 0.0)

    for seg in merged_segs:
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


def deduplicate_clips(clips: List[SuggestedClip]) -> List[SuggestedClip]:
    """Removes duplicate or heavily overlapping clips across window boundaries."""
    unique: List[SuggestedClip] = []
    for clip in clips:
        is_dup = False
        for u in unique:
            overlap_start = max(clip.start_time, u.start_time)
            overlap_end = min(clip.end_time, u.end_time)
            overlap_dur = max(0.0, overlap_end - overlap_start)
            min_dur = min(clip.end_time - clip.start_time, u.end_time - u.start_time)
            if min_dur > 0 and (overlap_dur / min_dur) > 0.4:
                is_dup = True
                break
        if not is_dup:
            unique.append(clip)
    return unique


def select_distributed_clips(clips: List[SuggestedClip], target_count: int) -> List[SuggestedClip]:
    """Selects target_count clips evenly distributed across the video timeline."""
    if len(clips) <= target_count:
        return clips
    sorted_clips = sorted(clips, key=lambda c: c.start_time)
    step = len(sorted_clips) / target_count
    return [sorted_clips[int(i * step)] for i in range(target_count)]


def _analyze_window(
    formatted_window_text: str,
    window_start: float,
    window_end: float,
    total_duration: float,
    provider: LLMProvider,
    model: Optional[str] = None,
    max_retries: int = 2,
    export_preset: str = "youtube_shorts",
    target_clips_count: int = 2,
    is_full_video: bool = False,
) -> List[SuggestedClip]:
    """Queries LLM with error correction loop for a single temporal window."""
    preset_info = get_export_preset(export_preset)
    preset_max_duration = float(preset_info.get("max_duration", 180.0))
    preset_name = preset_info.get("name", "Shorts")

    if is_full_video:
        target_desc = f"identify {target_clips_count} best self-contained"
        user_desc = f"Identify up to {target_clips_count} best short-form clips"
        window_spec = f"strictly between 0.0 and {total_duration:.2f}s"
    else:
        target_desc = f"identify 1 to {target_clips_count} self-contained"
        user_desc = f"Identify 1 to {target_clips_count} best viral moments from this section"
        window_spec = f"strictly between {window_start:.2f}s and {window_end:.2f}s (within total video length {total_duration:.2f}s)"

    system_prompt = (
        f"You are an expert short-form video editor specializing in {preset_name}, TikTok, YouTube Shorts, and Instagram Reels.\n"
        f"Your task is to analyze the video transcript section with timestamps and {target_desc} "
        "high-retention video clips that would perform exceptionally well as vertical shorts.\n\n"
        "CRITICAL REQUIREMENTS:\n"
        "1. Each clip MUST have a strong initial hook in the first 3-5 seconds.\n"
        "2. Each clip must be a complete, self-contained thought or story arc (no mid-sentence cutoffs).\n"
        f"3. Ideal duration for each clip is between 15 and {min(int(preset_max_duration), 90)} seconds (minimum 5s, strictly capped at maximum {int(preset_max_duration)}s for {preset_name}).\n"
        f"4. Timestamps (start_time and end_time) are in seconds as numbers, {window_spec}.\n"
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
        f"Here is the transcript section:\n\n"
        f"{formatted_window_text}\n\n"
        f"{user_desc} and output the JSON response now."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    last_error = None
    for attempt in range(max_retries + 1):
        raw_response = provider.chat(messages, model=model)
        try:
            parsed_json = extract_json_from_text(raw_response)
            validated_response = SuggestedClipsResponse.model_validate(parsed_json)

            # Enforce preset max duration capping and bounds
            valid_clips = []
            for c in validated_response.clips:
                # Clamp within video duration
                c.start_time = max(0.0, min(c.start_time, total_duration))
                c.end_time = max(c.start_time + 5.0, min(c.end_time, total_duration))

                if (c.end_time - c.start_time) > preset_max_duration:
                    c.end_time = min(total_duration, c.start_time + preset_max_duration)
                valid_clips.append(c)

            timestamp_errors = validate_clip_timestamps(valid_clips, total_duration)
            if timestamp_errors:
                raise ValueError("; ".join(timestamp_errors))

            return valid_clips

        except (json.JSONDecodeError, pydantic.ValidationError, ValueError) as err:
            last_error = err
            logger.warning(f"Window analysis attempt {attempt + 1} validation failed: {err}")
            if attempt < max_retries:
                messages.append({"role": "assistant", "content": raw_response})
                correction_prompt = (
                    f"Your previous response had validation errors:\n{err}\n\n"
                    f"Please correct the errors and output ONLY valid JSON strictly matching:\n"
                    '{"clips": [{"start_time": float, "end_time": float, "title": str, "reason": str}]}\n'
                    f"Ensure start_time and end_time are floating point seconds between 0.0 and {total_duration:.2f}s."
                )
                messages.append({"role": "user", "content": correction_prompt})

    raise RuntimeError(f"Failed window analysis after {max_retries + 1} attempts. Last error: {last_error}")


def analyze_transcript(
    transcript: Dict[str, Any],
    provider: LLMProvider,
    model: Optional[str] = None,
    max_retries: int = 2,
    export_preset: str = "youtube_shorts",
    num_clips: Optional[int] = None,
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
) -> List[SuggestedClip]:
    """
    Analyzes transcript with an LLM to identify self-contained, high-retention segments.
    Automatically segments long-form videos into temporal windows (10-minute chunks with 1-minute overlap)
    to guarantee prompts never exceed LLM context boundaries.
    """
    segments = transcript.get("segments", [])
    if not segments:
        raise ValueError("Transcript contains no segments to analyze.")

    total_duration = max((float(s.get("end", 0.0)) for s in segments), default=0.0)
    merged_segs = merge_segments_for_formatting(segments)
    if not merged_segs:
        raise ValueError("No valid speech text found in transcript.")

    # Check if single-window analysis is appropriate (under 12 minutes / 720s)
    single_window_max_dur = 720.0
    total_text_len = sum(len(s.get("text", "")) for s in merged_segs)

    if total_duration <= single_window_max_dur and total_text_len < 40000:
        logger.info(f"Analyzing short video ({total_duration:.1f}s) in single LLM window...")
        formatted = "\n".join(format_transcript_for_llm(transcript))
        target_count = num_clips if (num_clips and num_clips > 0) else 5
        clips = _analyze_window(
            formatted_window_text=formatted,
            window_start=0.0,
            window_end=total_duration,
            total_duration=total_duration,
            provider=provider,
            model=model,
            max_retries=max_retries,
            export_preset=export_preset,
            target_clips_count=target_count,
            is_full_video=True,
        )
        if num_clips and len(clips) > num_clips:
            clips = clips[:num_clips]
        return apply_heuristics_to_clips(clips, transcript)

    # Multi-window analysis for long-form content
    window_duration = 600.0  # 10 minutes
    overlap = 60.0          # 1 minute overlap
    step = window_duration - overlap

    windows = []
    t = 0.0
    while t < total_duration:
        w_end = min(t + window_duration, total_duration)
        w_segs = [s for s in merged_segs if s["end"] >= t and s["start"] <= w_end]
        if w_segs:
            windows.append((t, w_end, w_segs))
        if w_end >= total_duration:
            break
        t += step

    total_windows = len(windows)
    logger.info(f"Dividing {total_duration:.1f}s video into {total_windows} temporal windows for LLM analysis.")

    all_clips: List[SuggestedClip] = []
    target_per_window = 2

    for idx, (w_start, w_end, w_segs) in enumerate(windows):
        start_min, start_sec = int(w_start // 60), int(w_start % 60)
        end_min, end_sec = int(w_end // 60), int(w_end % 60)
        msg = f"Analyzing section {idx + 1}/{total_windows} [{start_min:02d}:{start_sec:02d} - {end_min:02d}:{end_sec:02d}]..."
        logger.info(msg)
        if progress_callback:
            try:
                progress_callback(idx + 1, total_windows, msg)
            except Exception:
                pass

        lines = [
            f"[{int(s['start']//60):02d}:{int(s['start']%60):02d} - {int(s['end']//60):02d}:{int(s['end']%60):02d}] ({s['start']:.2f}s - {s['end']:.2f}s): {s['text']}"
            for s in w_segs
        ]
        window_text = "\n".join(lines)

        try:
            window_clips = _analyze_window(
                formatted_window_text=window_text,
                window_start=w_start,
                window_end=w_end,
                total_duration=total_duration,
                provider=provider,
                model=model,
                max_retries=max_retries,
                export_preset=export_preset,
                target_clips_count=target_per_window,
                is_full_video=False,
            )
            all_clips.extend(window_clips)
        except Exception as e:
            logger.warning(f"Skipping window {idx + 1} due to analysis error: {e}")

    if not all_clips:
        raise RuntimeError("Failed to identify clips across all video windows.")

    # Deduplicate overlapping clips across window seams
    unique_clips = deduplicate_clips(all_clips)
    logger.info(f"Identified {len(unique_clips)} candidate clips across {total_windows} windows.")

    # If user specified num_clips, select evenly distributed clips across timeline
    if num_clips and num_clips > 0 and len(unique_clips) > num_clips:
        selected_clips = select_distributed_clips(unique_clips, num_clips)
    elif num_clips is None and len(unique_clips) > 8:
        # Default cap to top 8 clips
        selected_clips = select_distributed_clips(unique_clips, 8)
    else:
        selected_clips = unique_clips

    # Apply sentence boundary heuristic check
    final_clips = apply_heuristics_to_clips(selected_clips, transcript)
    logger.info(f"Successfully finalized {len(final_clips)} suggested clips.")
    return final_clips


def run_analysis_for_video(
    video_dir: Path,
    provider: Optional[LLMProvider] = None,
    model: Optional[str] = None,
    output_filename: str = "clips_suggested.json",
    export_preset: str = "youtube_shorts",
    num_clips: Optional[int] = None,
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
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

    clips = analyze_transcript(
        transcript_data,
        provider=provider,
        model=model,
        export_preset=export_preset,
        num_clips=num_clips,
        progress_callback=progress_callback,
    )

    output_path = video_dir / output_filename
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump([clip.model_dump() for clip in clips], f, indent=2, ensure_ascii=False)

    logger.info(f"Saved {len(clips)} suggested clips to {output_path}")
    return output_path

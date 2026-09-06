from typing import List, Dict, Any, Tuple, Optional
from clipzilla.schema import SuggestedClip


def extract_all_words(transcript: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extracts all words in chronological order from transcript segments."""
    words = []
    for seg in transcript.get("segments", []):
        for w in seg.get("words", []):
            words.append({
                "word": w.get("word", "").strip(),
                "start": float(w.get("start", 0.0)),
                "end": float(w.get("end", 0.0)),
            })
    words.sort(key=lambda x: x["start"])
    return words


def check_clip_boundaries(
    clip: SuggestedClip,
    words: List[Dict[str, Any]],
) -> Tuple[bool, str, Optional[float], Optional[float]]:
    """
    Analyzes whether a suggested clip starts or ends mid-sentence using word timestamps.
    Returns:
        (needs_trimming, notes, suggested_start, suggested_end)
    """
    if not words:
        return False, "No word-level timestamps available to verify boundaries.", None, None

    start_t = clip.start_time
    end_t = clip.end_time

    issues = []
    suggested_start = None
    suggested_end = None

    # 1. Evaluate Start Boundary
    # Find word overlapping or immediately following start_t
    start_idx = None
    for i, w in enumerate(words):
        if w["start"] <= start_t <= w["end"]:
            # Inside a word
            start_idx = i
            if start_t > w["start"] + 0.1:
                issues.append(f"Cuts mid-word on '{w['word']}'")
                suggested_start = w["start"]
            break
        elif w["start"] > start_t:
            start_idx = i
            break

    if start_idx is None:
        start_idx = len(words) - 1

    current_start_word = words[start_idx]
    # Check preceding word for sentence termination
    if start_idx > 0:
        prev_word = words[start_idx - 1]
        ends_punctuation = any(prev_word["word"].endswith(p) for p in [".", "!", "?"])
        has_pause = (current_start_word["start"] - prev_word["end"]) >= 0.4
        is_lowercase = current_start_word["word"] and current_start_word["word"][0].islower()

        if not ends_punctuation and not has_pause:
            issues.append(f"Starts mid-sentence on '{current_start_word['word']}'")
            # Find closest previous sentence start
            for back_i in range(start_idx - 1, max(-1, start_idx - 15), -1):
                if any(words[back_i]["word"].endswith(p) for p in [".", "!", "?"]):
                    suggested_start = words[back_i + 1]["start"]
                    break

    # 2. Evaluate End Boundary
    # Find word ending closest to end_t
    end_idx = None
    for i in range(len(words) - 1, -1, -1):
        w = words[i]
        if w["start"] <= end_t <= w["end"]:
            end_idx = i
            if end_t < w["end"] - 0.1:
                issues.append(f"Cuts mid-word on '{w['word']}'")
                suggested_end = w["end"]
            break
        elif w["end"] <= end_t:
            end_idx = i
            break

    if end_idx is None:
        end_idx = 0

    current_end_word = words[end_idx]
    # Check if end word terminates sentence
    ends_punctuation = any(current_end_word["word"].endswith(p) for p in [".", "!", "?"])
    has_following_pause = False
    if end_idx + 1 < len(words):
        has_following_pause = (words[end_idx + 1]["start"] - current_end_word["end"]) >= 0.45

    if not ends_punctuation and not has_following_pause:
        issues.append(f"Ends mid-sentence on '{current_end_word['word']}'")
        # Find next sentence ending
        for fwd_i in range(end_idx, min(len(words), end_idx + 15)):
            if any(words[fwd_i]["word"].endswith(p) for p in [".", "!", "?"]):
                suggested_end = words[fwd_i]["end"]
                break

    needs_trimming = len(issues) > 0
    if needs_trimming:
        notes = "; ".join(issues)
        if suggested_start or suggested_end:
            s_str = f"{suggested_start:.2f}s" if suggested_start is not None else f"{start_t:.2f}s"
            e_str = f"{suggested_end:.2f}s" if suggested_end is not None else f"{end_t:.2f}s"
            notes += f". Suggested window: {s_str} - {e_str}."
    else:
        notes = "Clean sentence boundaries."

    return needs_trimming, notes, suggested_start, suggested_end


def apply_heuristics_to_clips(
    clips: List[SuggestedClip],
    transcript: Dict[str, Any],
) -> List[SuggestedClip]:
    """Applies sentence-boundary heuristics to all suggested clips."""
    words = extract_all_words(transcript)
    for clip in clips:
        needs_trimming, notes, _, _ = check_clip_boundaries(clip, words)
        clip.needs_trimming = needs_trimming
        clip.trimming_notes = notes
    return clips

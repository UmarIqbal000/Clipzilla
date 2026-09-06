from pathlib import Path
from typing import List, Dict, Any, Union
import json

from clipzilla.config import TARGET_WIDTH, TARGET_HEIGHT


def format_ass_time(seconds: float) -> str:
    """Formats seconds as H:MM:SS.cc for ASS subtitles."""
    seconds = max(0.0, seconds)
    total_cs = int(round(seconds * 100))
    cs = total_cs % 100
    total_s = total_cs // 100
    s = total_s % 60
    total_m = total_s // 60
    m = total_m % 60
    h = total_m // 60
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def group_words_into_phrases(words: List[Dict[str, Any]], max_words_per_phrase: int = 4) -> List[List[Dict[str, Any]]]:
    """
    Groups words into short phrases (3-5 words) suitable for vertical shorts.
    Splits phrases on punctuation (., ?, !) or pauses > 0.5s.
    """
    phrases = []
    current_phrase = []

    for word_info in words:
        if not current_phrase:
            current_phrase.append(word_info)
            continue

        prev_word = current_phrase[-1]
        gap = word_info["start"] - prev_word["end"]
        ends_sentence = any(prev_word["word"].endswith(p) for p in [".", "?", "!"])

        if len(current_phrase) >= max_words_per_phrase or gap > 0.5 or ends_sentence:
            phrases.append(current_phrase)
            current_phrase = [word_info]
        else:
            current_phrase.append(word_info)

    if current_phrase:
        phrases.append(current_phrase)

    return phrases


def generate_ass_subtitles(
    transcript: Union[Dict[str, Any], Path, str],
    clip_start: float,
    clip_end: float,
    output_ass_path: Path,
    highlight_color: str = "&H0000FFFF&",  # Yellow in &HAABBGGRR&
    text_color: str = "&H00FFFFFF&",       # White
    font_size: int = 72,
    margin_v: int = 450,
) -> Path:
    """
    Generates an ASS subtitle file from transcript data for a specific clip timeframe.
    Word timestamps are adjusted relative to 00:00:00.00.
    Words are highlighted as they are spoken.
    """
    if isinstance(transcript, (str, Path)):
        with open(transcript, "r", encoding="utf-8") as f:
            transcript_data = json.load(f)
    else:
        transcript_data = transcript

    clip_duration = max(0.0, clip_end - clip_start)

    # 1. Flatten all words from all segments
    all_words = []
    for seg in transcript_data.get("segments", []):
        for w in seg.get("words", []):
            if w["end"] > clip_start and w["start"] < clip_end:
                # Re-base timestamps relative to clip_start
                rel_start = max(0.0, w["start"] - clip_start)
                rel_end = min(clip_duration, w["end"] - clip_start)
                if rel_end > rel_start:
                    all_words.append({
                        "word": w["word"].strip(),
                        "start": rel_start,
                        "end": rel_end,
                    })

    # Sort words by start time
    all_words.sort(key=lambda x: x["start"])

    # 2. Group into short phrases
    phrases = group_words_into_phrases(all_words, max_words_per_phrase=4)

    # 3. Create ASS header and styling
    ass_lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {TARGET_WIDTH}",
        f"PlayResY: {TARGET_HEIGHT}",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Default,Arial,{font_size},{text_color},&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,0,2,40,40,{margin_v},1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    # 4. Generate dialogue events with active-word highlight
    for phrase in phrases:
        phrase_start = phrase[0]["start"]
        phrase_end = phrase[-1]["end"]

        for active_idx, active_word in enumerate(phrase):
            w_start = active_word["start"]
            w_end = active_word["end"]

            # Small boundary check
            if w_end <= w_start:
                continue

            # Build line text with active word highlighted
            word_fragments = []
            for idx, word_item in enumerate(phrase):
                clean_w = word_item["word"].upper()
                if idx == active_idx:
                    # Highlight active word
                    word_fragments.append(f"{{\\c{highlight_color}}}{clean_w}{{\\c{text_color}}}")
                else:
                    word_fragments.append(clean_w)

            dialogue_text = " ".join(word_fragments)
            start_str = format_ass_time(w_start)
            end_str = format_ass_time(w_end)

            ass_lines.append(
                f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{dialogue_text}"
            )

    output_ass_path = Path(output_ass_path)
    output_ass_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write("\n".join(ass_lines) + "\n")

    return output_ass_path

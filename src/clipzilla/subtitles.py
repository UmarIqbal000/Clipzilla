from pathlib import Path
from typing import List, Dict, Any, Union, Optional
import json

from clipzilla.config import TARGET_WIDTH, TARGET_HEIGHT

COLOR_MAP = {
    "yellow": "&H0000FFFF&",
    "gold": "&H0000D7FF&",
    "cyan": "&H00FFFF00&",
    "green": "&H0000FF00&",
    "white": "&H00FFFFFF&",
    "red": "&H000000FF&",
    "magenta": "&H00FF00FF&",
    "blue": "&H00FF5500&",
}


def parse_ass_color(val: str, default: str = "&H0000FFFF&") -> str:
    """Parses color names ('yellow', 'cyan', etc.) or #RRGGBB hex into ASS &HAABBGGRR& format."""
    if not val:
        return default
    val = val.strip().lower()
    if val in COLOR_MAP:
        return COLOR_MAP[val]
    if val.startswith("&h") or val.startswith("&H"):
        res = val.upper()
        return res if res.endswith("&") else res + "&"
    if val.startswith("#"):
        hex_val = val.lstrip("#")
        if len(hex_val) == 6:
            r = hex_val[0:2].upper()
            g = hex_val[2:4].upper()
            b = hex_val[4:6].upper()
            return f"&H00{b}{g}{r}&"
    return default


def parse_position_margin(val: Union[str, int], default: int = 450) -> int:
    """Parses vertical position ('bottom', 'middle', 'top' or integer margin)."""
    if isinstance(val, int):
        return val
    if not val:
        return default
    s = str(val).strip().lower()
    if s == "bottom":
        return 450
    elif s == "middle" or s == "center":
        return 900
    elif s == "top":
        return 1450
    try:
        return int(s)
    except ValueError:
        return default


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
    Splits phrases on punctuation (., ?, !) or pauses > 0.45s.
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

        if len(current_phrase) >= max_words_per_phrase or gap > 0.45 or ends_sentence:
            phrases.append(current_phrase)
            current_phrase = [word_info]
        else:
            current_phrase.append(word_info)

    if current_phrase:
        phrases.append(current_phrase)

    return phrases


def generate_ass_subtitles(
    transcript: Optional[Union[Dict[str, Any], Path, str]] = None,
    clip_start: float = 0.0,
    clip_end: float = 0.0,
    output_ass_path: Path = Path("subtitles.ass"),
    preset: str = "karaoke",  # 'karaoke' or 'single'
    font_name: str = "Arial",
    highlight_color: str = "&H0000FFFF&",
    text_color: str = "&H00FFFFFF&",
    font_size: Optional[int] = None,
    margin_v: Union[str, int] = 450,
    position: Optional[Union[str, int]] = None,
    caption_overrides: Optional[List[Dict[str, Any]]] = None,
) -> Path:
    """
    Generates an animated ASS subtitle file for a specific clip timeframe.

    Presets:
      - 'single': Bold pop-up single active word (1 word on screen, animated scale punch).
      - 'karaoke': Line-level progressive highlight (3-5 words on screen, active word illuminated).

    Configurable: font, color, position (margin_v), and preset.
    Supports user-provided caption_overrides.
    """
    clip_duration = max(0.0, clip_end - clip_start)

    parsed_highlight = parse_ass_color(highlight_color, default="&H0000FFFF&")
    parsed_text = parse_ass_color(text_color, default="&H00FFFFFF&")
    effective_pos = position if position is not None else margin_v
    parsed_margin_v = parse_position_margin(effective_pos, default=450)

    if font_size is None:
        font_size = 88 if preset == "single" else 76

    all_words = []
    if caption_overrides:
        # Use user-edited caption lines
        for line in caption_overrides:
            text = line.get("text", "").strip()
            l_start = float(line.get("start", 0))
            l_end = float(line.get("end", 0))
            words = text.split()
            if not words:
                continue
            step = max(0.05, (l_end - l_start) / len(words))
            for idx, w in enumerate(words):
                w_start = l_start + idx * step
                w_end = l_start + (idx + 1) * step
                if w_end > clip_start and w_start < clip_end:
                    rel_start = max(0.0, w_start - clip_start)
                    rel_end = min(clip_duration, w_end - clip_start)
                    if rel_end > rel_start:
                        all_words.append({
                            "word": w.strip(),
                            "start": rel_start,
                            "end": rel_end,
                        })
    elif transcript:
        if isinstance(transcript, (str, Path)):
            with open(transcript, "r", encoding="utf-8") as f:
                transcript_data = json.load(f)
        else:
            transcript_data = transcript

        for seg in transcript_data.get("segments", []):
            for w in seg.get("words", []):
                if w["end"] > clip_start and w["start"] < clip_end:
                    rel_start = max(0.0, w["start"] - clip_start)
                    rel_end = min(clip_duration, w["end"] - clip_start)
                    if rel_end > rel_start:
                        all_words.append({
                            "word": w["word"].strip(),
                            "start": rel_start,
                            "end": rel_end,
                        })

    all_words.sort(key=lambda x: x["start"])

    # 2. Build ASS Header & Styles
    ass_lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {TARGET_WIDTH}",
        f"PlayResY: {TARGET_HEIGHT}",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Default,{font_name},{font_size},{parsed_text},&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,0,2,40,40,{parsed_margin_v},1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    # 3. Generate dialogue events based on preset
    if preset == "single":
        # Preset A: Bold pop-up single active word
        for word_info in all_words:
            w_start = word_info["start"]
            w_end = word_info["end"]
            clean_w = word_info["word"].upper()

            if w_end <= w_start:
                continue

            start_str = format_ass_time(w_start)
            end_str = format_ass_time(w_end)

            # Punchy scale pop animation: scale 115% -> 100% in 80ms
            pop_anim = r"{\fscx115\fscy115\t(0,80,\fscx100\fscy100)}"
            color_tag = f"{{\\c{parsed_highlight}}}"
            dialogue_text = f"{pop_anim}{color_tag}{clean_w}"

            ass_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{dialogue_text}")

    else:
        # Preset B: Karaoke-style progressive highlight across a line
        phrases = group_words_into_phrases(all_words, max_words_per_phrase=4)

        for phrase in phrases:
            for active_idx, active_word in enumerate(phrase):
                w_start = active_word["start"]
                w_end = active_word["end"]

                if w_end <= w_start:
                    continue

                word_fragments = []
                for idx, word_item in enumerate(phrase):
                    clean_w = word_item["word"].upper()
                    if idx == active_idx:
                        word_fragments.append(f"{{\\c{parsed_highlight}}}{clean_w}{{\\c{parsed_text}}}")
                    else:
                        word_fragments.append(clean_w)

                dialogue_text = " ".join(word_fragments)
                start_str = format_ass_time(w_start)
                end_str = format_ass_time(w_end)

                ass_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{dialogue_text}")

    output_ass_path = Path(output_ass_path)
    output_ass_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write("\n".join(ass_lines) + "\n")

    return output_ass_path

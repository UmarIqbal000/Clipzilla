import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import html


def parse_timestamp(ts: str) -> float:
    """
    Parses timestamp strings like:
    '00:01:23.456', '01:23.456', '00:01:23,456' into seconds as float.
    """
    ts = ts.strip().replace(",", ".")
    parts = ts.split(":")
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    elif len(parts) == 2:
        m, s = parts
        return int(m) * 60 + float(s)
    elif len(parts) == 1:
        return float(parts[0])
    raise ValueError(f"Invalid timestamp format: {ts}")


def clean_text(text: str) -> str:
    """Strips HTML/VTT tags and unescapes HTML entities."""
    # Remove tags like <c>, </c>, <00:00:00.000>, <b>, etc.
    cleaned = re.sub(r"<[^>]+>", "", text)
    cleaned = html.unescape(cleaned)
    # Normalize whitespace
    return re.sub(r"\s+", " ", cleaned).strip()


def parse_vtt_or_srt(file_path: Path) -> List[Dict[str, Any]]:
    """
    Parses a WebVTT or SRT file into a list of raw cues.
    Each cue has: {'start': float, 'end': float, 'raw_text': str}
    """
    content = file_path.read_text(encoding="utf-8", errors="replace")
    # Match cue timing line: 00:00:00.000 --> 00:00:02.000
    timing_pattern = re.compile(
        r"(\d{1,2}:\d{2}(?::\d{2})?[\.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[\.,]\d{3})"
    )

    lines = content.splitlines()
    cues = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        match = timing_pattern.search(line)
        if match:
            start_ts = parse_timestamp(match.group(1))
            end_ts = parse_timestamp(match.group(2))
            i += 1
            cue_text_lines = []
            while i < len(lines) and lines[i].strip() != "":
                # If we encounter next timing line without empty line (rare), break
                if timing_pattern.search(lines[i]):
                    break
                cue_text_lines.append(lines[i])
                i += 1
            raw_text = "\n".join(cue_text_lines)
            if raw_text.strip():
                cues.append({
                    "start": start_ts,
                    "end": end_ts,
                    "raw_text": raw_text
                })
        else:
            i += 1
    return cues


def convert_captions_to_transcript(caption_path: Path, video_id: str) -> Dict[str, Any]:
    """
    Converts a downloaded VTT or SRT caption file into the standardized
    transcript JSON format with word-level timestamps.
    """
    cues = parse_vtt_or_srt(caption_path)
    segments = []
    seen_words = set()

    # Regex for word tags like <00:00:01.200><c> word</c> or <00:00:01.200>word
    word_tag_pattern = re.compile(
        r"<(\d{1,2}:\d{2}(?::\d{2})?[\.,]\d{3})>(?:<c>)?\s*([^<]+?)\s*(?:</c>|$)"
    )

    segment_id = 0
    for cue in cues:
        start_time = cue["start"]
        end_time = cue["end"]
        raw_text = cue["raw_text"]

        words_found = []
        matches = list(word_tag_pattern.finditer(raw_text))

        if matches:
            # Word-level tags present
            for idx, m in enumerate(matches):
                w_start = parse_timestamp(m.group(1))
                w_word = clean_text(m.group(2))
                if not w_word:
                    continue

                if idx + 1 < len(matches):
                    w_end = parse_timestamp(matches[idx + 1].group(1))
                else:
                    w_end = end_time

                # Bound check
                w_end = max(w_start + 0.05, w_end)

                # Deduplicate rolling captions
                word_key = (round(w_start, 2), w_word.lower())
                if word_key in seen_words:
                    continue
                seen_words.add(word_key)

                words_found.append({
                    "word": w_word,
                    "start": round(w_start, 3),
                    "end": round(w_end, 3),
                })
        else:
            # No word tags: split cleaned text and interpolate evenly
            cleaned = clean_text(raw_text)
            tokens = cleaned.split()
            if not tokens:
                continue

            duration = max(0.1, end_time - start_time)
            dt = duration / len(tokens)

            for idx, token in enumerate(tokens):
                w_start = start_time + idx * dt
                w_end = start_time + (idx + 1) * dt

                word_key = (round(w_start, 2), token.lower())
                if word_key in seen_words:
                    continue
                seen_words.add(word_key)

                words_found.append({
                    "word": token,
                    "start": round(w_start, 3),
                    "end": round(w_end, 3),
                })

        if words_found:
            seg_start = words_found[0]["start"]
            seg_end = words_found[-1]["end"]
            seg_text = " ".join(w["word"] for w in words_found)
            segments.append({
                "id": segment_id,
                "start": seg_start,
                "end": seg_end,
                "text": seg_text,
                "words": words_found,
            })
            segment_id += 1

    return {
        "video_id": video_id,
        "source": "youtube_captions",
        "language": "en",
        "segments": segments,
    }


# Also expose animated ASS subtitle generation from captions module
from clipzilla.subtitles import generate_ass_subtitles, format_ass_time, parse_ass_color


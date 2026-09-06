import unittest
import tempfile
from pathlib import Path

from clipzilla.captions import (
    parse_timestamp,
    clean_text,
    convert_captions_to_transcript,
)
from clipzilla.subtitles import (
    format_ass_time,
    group_words_into_phrases,
    generate_ass_subtitles,
)


class TestCaptionsAndSubtitles(unittest.TestCase):
    def test_parse_timestamp(self):
        self.assertAlmostEqual(parse_timestamp("00:01:23.456"), 83.456)
        self.assertAlmostEqual(parse_timestamp("01:23.456"), 83.456)
        self.assertAlmostEqual(parse_timestamp("00:01:23,456"), 83.456)
        self.assertAlmostEqual(parse_timestamp("12.5"), 12.5)

    def test_clean_text(self):
        raw = "<00:00:01.000><c> Hello</c> &amp; <b>World</b>!"
        cleaned = clean_text(raw)
        self.assertEqual(cleaned, "Hello & World!")

    def test_convert_captions_with_word_tags(self):
        vtt_content = """WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:02.500
<00:00:00.000><c> Clipzilla</c><00:00:00.500><c> devours</c><00:00:01.200><c> videos</c>
"""
        with tempfile.TemporaryDirectory() as tmpdir:
            vtt_path = Path(tmpdir) / "source.en.vtt"
            vtt_path.write_text(vtt_content, encoding="utf-8")

            transcript = convert_captions_to_transcript(vtt_path, video_id="test123")
            self.assertEqual(transcript["video_id"], "test123")
            self.assertEqual(transcript["source"], "youtube_captions")
            self.assertTrue(len(transcript["segments"]) > 0)
            words = transcript["segments"][0]["words"]
            self.assertEqual(len(words), 3)
            self.assertEqual(words[0]["word"], "Clipzilla")
            self.assertEqual(words[1]["word"], "devours")
            self.assertEqual(words[2]["word"], "videos")

    def test_convert_captions_without_word_tags(self):
        srt_content = """1
00:00:01,000 --> 00:00:03,000
Clipzilla devours videos
"""
        with tempfile.TemporaryDirectory() as tmpdir:
            srt_path = Path(tmpdir) / "source.en.srt"
            srt_path.write_text(srt_content, encoding="utf-8")

            transcript = convert_captions_to_transcript(srt_path, video_id="test456")
            self.assertEqual(transcript["video_id"], "test456")
            words = transcript["segments"][0]["words"]
            self.assertEqual(len(words), 3)
            # Check linear interpolation
            self.assertAlmostEqual(words[0]["start"], 1.0, places=2)
            self.assertAlmostEqual(words[2]["end"], 3.0, places=2)

    def test_format_ass_time(self):
        self.assertEqual(format_ass_time(0), "0:00:00.00")
        self.assertEqual(format_ass_time(61.25), "0:01:01.25")
        self.assertEqual(format_ass_time(3600), "1:00:00.00")

    def test_group_words_into_phrases(self):
        words = [
            {"word": "Word1", "start": 0.0, "end": 0.5},
            {"word": "Word2", "start": 0.5, "end": 1.0},
            {"word": "Word3.", "start": 1.0, "end": 1.5},
            {"word": "Word4", "start": 1.6, "end": 2.0},
        ]
        phrases = group_words_into_phrases(words, max_words_per_phrase=4)
        # Sentence boundary on Word3. should split into 2 phrases
        self.assertEqual(len(phrases), 2)
        self.assertEqual(len(phrases[0]), 3)
        self.assertEqual(len(phrases[1]), 1)

    def test_generate_ass_subtitles(self):
        transcript_data = {
            "video_id": "test_video",
            "segments": [
                {
                    "id": 0,
                    "start": 10.0,
                    "end": 15.0,
                    "text": "Hello world from Clipzilla",
                    "words": [
                        {"word": "Hello", "start": 10.0, "end": 11.0},
                        {"word": "world", "start": 11.0, "end": 12.0},
                        {"word": "from", "start": 12.0, "end": 13.0},
                        {"word": "Clipzilla", "start": 13.0, "end": 14.5},
                    ],
                }
            ],
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            ass_path = Path(tmpdir) / "output.ass"
            generate_ass_subtitles(
                transcript=transcript_data,
                clip_start=10.0,
                clip_end=15.0,
                output_ass_path=ass_path,
            )
            self.assertTrue(ass_path.exists())
            content = ass_path.read_text(encoding="utf-8")
            self.assertIn("PlayResX: 1080", content)
            self.assertIn("PlayResY: 1920", content)
            # Verify relative timestamps starting near 0:00:00.00
            self.assertIn("Dialogue: 0,0:00:00.00,0:00:01.00", content)
            # Verify active word highlight tag
            self.assertIn(r"{\c&H0000FFFF&}HELLO{\c&H00FFFFFF&}", content)

    def test_generate_ass_single_word_preset(self):
        transcript_data = {
            "video_id": "test_single",
            "segments": [
                {
                    "id": 0,
                    "start": 5.0,
                    "end": 8.0,
                    "text": "Monster devours video",
                    "words": [
                        {"word": "Monster", "start": 5.0, "end": 6.0},
                        {"word": "devours", "start": 6.0, "end": 7.0},
                        {"word": "video", "start": 7.0, "end": 8.0},
                    ],
                }
            ],
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            ass_path = Path(tmpdir) / "output_single.ass"
            generate_ass_subtitles(
                transcript=transcript_data,
                clip_start=5.0,
                clip_end=8.0,
                output_ass_path=ass_path,
                preset="single",
                highlight_color="cyan",
                position="middle",
            )
            self.assertTrue(ass_path.exists())
            content = ass_path.read_text(encoding="utf-8")
            # Style should have middle margin 900
            self.assertIn(",900,1", content)
            # Should have scale punch animation tags
            self.assertIn(r"\fscx115\fscy115", content)
            # Cyan color in BGR format
            self.assertIn(r"{\c&H00FFFF00&}MONSTER", content)


if __name__ == "__main__":
    unittest.main()

import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path
import tempfile
import json

from clipzilla.presets import (
    EXPORT_PRESETS,
    get_export_preset,
    validate_export_preset,
)
from clipzilla.analyzer import analyze_transcript
from clipzilla.clipper import cut_clip


class DummyProvider:
    def __init__(self, response_text: str):
        self.response_text = response_text

    def chat(self, messages, model=None):
        return self.response_text


class TestExportPresets(unittest.TestCase):
    def test_preset_definitions(self):
        """Tests that TikTok, YouTube Shorts, and Instagram Reels presets are defined correctly."""
        self.assertTrue(validate_export_preset("youtube_shorts"))
        self.assertTrue(validate_export_preset("tiktok"))
        self.assertTrue(validate_export_preset("instagram_reels"))

        yt = get_export_preset("youtube_shorts")
        self.assertEqual(yt["max_duration"], 180.0)
        self.assertEqual(yt["video_bitrate"], "10M")
        self.assertEqual(yt["width"], 1080)
        self.assertEqual(yt["height"], 1920)

        tiktok = get_export_preset("tiktok")
        self.assertEqual(tiktok["max_duration"], 600.0)
        self.assertEqual(tiktok["video_bitrate"], "12M")

        reels = get_export_preset("instagram_reels")
        self.assertEqual(reels["max_duration"], 180.0)
        self.assertEqual(reels["video_bitrate"], "8M")

    def test_analyzer_enforces_preset_duration_cap(self):
        """Tests that analyze_transcript caps clip duration exceeding preset limits."""
        # Simulated LLM output suggesting a 250s clip
        fake_llm_json = json.dumps({
            "clips": [
                {
                    "start_time": 10.0,
                    "end_time": 260.0,  # 250 seconds duration
                    "title": "A Very Long Clip",
                    "reason": "High retention story",
                }
            ]
        })
        provider = DummyProvider(fake_llm_json)

        dummy_transcript = {
            "segments": [
                {
                    "start": 0.0,
                    "end": 300.0,
                    "text": "This is a long video segment with enough speech to cover 300 seconds.",
                    "words": [
                        {"word": "This", "start": 0.0, "end": 1.0},
                        {"word": "segment", "start": 290.0, "end": 295.0},
                    ],
                }
            ]
        }

        # 1. Test with YouTube Shorts preset (180s cap)
        yt_clips = analyze_transcript(
            transcript=dummy_transcript,
            provider=provider,
            export_preset="youtube_shorts",
        )
        self.assertEqual(len(yt_clips), 1)
        self.assertLessEqual(yt_clips[0].end_time - yt_clips[0].start_time, 180.0)

        # 2. Test with TikTok preset (up to 600s cap: clip stays 250s)
        tiktok_clips = analyze_transcript(
            transcript=dummy_transcript,
            provider=provider,
            export_preset="tiktok",
        )
        self.assertEqual(len(tiktok_clips), 1)
        self.assertAlmostEqual(tiktok_clips[0].end_time - tiktok_clips[0].start_time, 250.0)

    @patch("subprocess.run")
    @patch("clipzilla.reframe.build_reframe_filter")
    def test_clipper_applies_preset_bitrate(self, mock_reframe, mock_run):
        """Tests that cut_clip sets the video bitrate according to the export preset in FFmpeg."""
        mock_reframe.return_value = ("scale=1080:1920", {"strategy": "center_crop"})
        mock_run.return_value = MagicMock(returncode=0)

        with tempfile.TemporaryDirectory() as temp_dir:
            video_dir = Path(temp_dir)
            source_mp4 = video_dir / "source.mp4"
            source_mp4.touch()

            # Mock temp file existence for cut_clip validation
            def side_effect(cmd, *args, **kwargs):
                cwd = kwargs.get("cwd")
                out_name = cmd[-1]
                out_path = Path(cwd) / out_name if cwd else Path(out_name)
                out_path.write_text("fake video data")
                return MagicMock(returncode=0)

            mock_run.side_effect = side_effect

            # 1. TikTok preset (12M bitrate)
            cut_clip(
                video_dir=video_dir,
                start=0.0,
                end=10.0,
                burn_subtitles=False,
                reframe_mode="center",
                export_preset="tiktok",
                overwrite=True,
            )
            cmd1 = mock_run.call_args_list[0][0][0]
            self.assertIn("-b:v", cmd1)
            b_idx = cmd1.index("-b:v")
            self.assertEqual(cmd1[b_idx + 1], "12M")

            # 2. Instagram Reels preset (8M bitrate)
            cut_clip(
                video_dir=video_dir,
                start=0.0,
                end=10.0,
                burn_subtitles=False,
                reframe_mode="center",
                export_preset="instagram_reels",
                overwrite=True,
            )
            cmd2 = mock_run.call_args_list[1][0][0]
            b_idx2 = cmd2.index("-b:v")
            self.assertEqual(cmd2[b_idx2 + 1], "8M")


if __name__ == "__main__":
    unittest.main()

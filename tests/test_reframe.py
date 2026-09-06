import unittest
from pathlib import Path
import tempfile
import cv2
import numpy as np

from clipzilla.reframe import (
    smooth_speaker_positions,
    build_reframe_filter,
)


class TestReframe(unittest.TestCase):
    def test_smooth_speaker_positions(self):
        # Raw samples with minor jitter and one missing detection (None)
        samples = [
            (0.0, 0.50, 0.9),
            (0.5, 0.51, 0.85),  # minor noise
            (1.0, None, 0.0),   # missing
            (1.5, 0.52, 0.88),  # minor noise
            (2.0, 0.70, 0.95),  # intentional pan right
        ]
        smoothed = smooth_speaker_positions(samples, alpha=0.3, deadband=0.03)
        self.assertEqual(len(smoothed), len(samples))

        # Check missing sample at 1.0s was interpolated
        self.assertIsNotNone(smoothed[2][1])
        # Check smoothing dampens rapid jump
        self.assertLess(smoothed[4][1], 0.70)
        self.assertGreater(smoothed[4][1], 0.50)

    def test_blur_filter_generation(self):
        # Create a tiny 1-frame dummy video
        with tempfile.TemporaryDirectory() as tmpdir:
            dummy_video = Path(tmpdir) / "dummy.mp4"
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(str(dummy_video), fourcc, 10.0, (640, 360))
            frame = np.zeros((360, 640, 3), dtype=np.uint8)
            out.write(frame)
            out.release()

            filter_str, info = build_reframe_filter(
                video_path=dummy_video,
                start=0.0,
                end=0.5,
                mode="blur",
            )
            self.assertEqual(info["strategy"], "blurred_fill")
            self.assertIn("boxblur", filter_str)
            self.assertIn("split=2", filter_str)
            self.assertIn("overlay=", filter_str)

    def test_center_filter_generation(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            dummy_video = Path(tmpdir) / "dummy.mp4"
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(str(dummy_video), fourcc, 10.0, (1920, 1080))
            frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
            out.write(frame)
            out.release()

            filter_str, info = build_reframe_filter(
                video_path=dummy_video,
                start=0.0,
                end=0.5,
                mode="center",
            )
            self.assertEqual(info["strategy"], "static_center")
            self.assertIn("crop=", filter_str)
            self.assertIn("scale=1080:1920", filter_str)


if __name__ == "__main__":
    unittest.main()

import unittest
from pathlib import Path
import numpy as np

from clipzilla.reframe import build_reframe_filter, get_speaker_crop_path


class TestReframeOverrides(unittest.TestCase):
    def test_crop_override_center(self):
        filter_str, info = build_reframe_filter(
            video_path=Path("dummy.mp4"),
            start=0.0,
            end=10.0,
            mode="auto",
            crop_override={"mode": "center"},
        )
        self.assertEqual(info["strategy"], "center_override")
        self.assertIn("crop=", filter_str)
        self.assertIn("scale=1080:1920", filter_str)

    def test_crop_override_left_and_right(self):
        filter_str_l, info_l = build_reframe_filter(
            video_path=Path("dummy.mp4"),
            start=0.0,
            end=10.0,
            mode="auto",
            crop_override={"mode": "left"},
        )
        self.assertEqual(info_l["strategy"], "left_override")

        filter_str_r, info_r = build_reframe_filter(
            video_path=Path("dummy.mp4"),
            start=0.0,
            end=10.0,
            mode="auto",
            crop_override={"mode": "right"},
        )
        self.assertEqual(info_r["strategy"], "right_override")
        self.assertGreater(info_r["crop_x"], info_l["crop_x"])

    def test_crop_override_manual(self):
        filter_str, info = build_reframe_filter(
            video_path=Path("dummy.mp4"),
            start=0.0,
            end=10.0,
            mode="auto",
            crop_override={"mode": "manual", "center_x": 0.8},
        )
        self.assertEqual(info["strategy"], "manual_override")
        self.assertIn("crop=", filter_str)

    def test_crop_override_blur(self):
        filter_str, info = build_reframe_filter(
            video_path=Path("dummy.mp4"),
            start=0.0,
            end=10.0,
            mode="auto",
            crop_override={"mode": "blur"},
        )
        self.assertEqual(info["strategy"], "blurred_fill_override")
        self.assertIn("boxblur", filter_str)


if __name__ == "__main__":
    unittest.main()

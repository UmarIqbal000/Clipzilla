import json
import subprocess
import tempfile
from pathlib import Path
import unittest

from clipzilla.downloader import download_video
from clipzilla.transcriber import transcribe_video
from clipzilla.clipper import cut_clip


class TestPipelineEndToEnd(unittest.TestCase):
    """
    End-to-end integration test running the full pipeline on a real ~2 minute
    YouTube video (Python in 100 Seconds - x7X9w_GIm1s).
    """

    TEST_URL = "https://www.youtube.com/watch?v=x7X9w_GIm1s"
    VIDEO_ID = "x7X9w_GIm1s"

    def test_full_pipeline(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workdir = Path(tmpdir)

            # Step 1: Download
            print("\n[Step 1] Downloading video...")
            dl_res = download_video(self.TEST_URL, workdir=workdir)
            video_dir = dl_res["video_dir"]
            video_file = dl_res["video_path"]

            self.assertTrue(video_dir.exists(), f"Video dir {video_dir} does not exist")
            self.assertTrue(video_file.exists(), f"Video file {video_file} does not exist")
            self.assertGreater(video_file.stat().st_size, 0, "Downloaded video file is empty")

            metadata_file = video_dir / "metadata.json"
            self.assertTrue(metadata_file.exists(), "metadata.json was not created")

            # Step 2: Transcribe via captions (if available)
            print("\n[Step 2] Transcribing via captions fallback...")
            transcript_res = transcribe_video(video_dir=video_dir, force_whisper=False)
            transcript_file = video_dir / "transcript.json"
            self.assertTrue(transcript_file.exists(), "transcript.json was not created")
            self.assertGreater(len(transcript_res.get("segments", [])), 0, "No segments in transcript")

            # Step 3: Transcribe via faster-whisper (tiny model for fast test execution)
            print("\n[Step 3] Transcribing via faster-whisper (force_whisper=True, model=tiny)...")
            whisper_res = transcribe_video(
                video_dir=video_dir,
                force_whisper=True,
                model_size="tiny",
            )
            self.assertEqual(whisper_res.get("source"), "whisper")
            self.assertGreater(len(whisper_res.get("segments", [])), 0, "Whisper produced 0 segments")

            first_segment = whisper_res["segments"][0]
            self.assertIn("words", first_segment)
            print(f"Sample whisper text: {first_segment.get('text')}")

            # Step 4: Clip segment (5s to 15s = 10s short)
            print("\n[Step 4] Cutting 1080x1920 short with burned ASS subtitles (5s -> 15s)...")
            clip_path = cut_clip(
                video_dir=video_dir,
                start=5.0,
                end=15.0,
                burn_subtitles=True,
            )

            self.assertTrue(clip_path.exists(), f"Output short {clip_path} does not exist")
            self.assertGreater(clip_path.stat().st_size, 0, "Output short is empty")

            # Step 5: Verify resolution and format with ffprobe
            print("\n[Step 5] Probing output video dimensions and stream...")
            ffprobe_cmd = [
                "ffprobe",
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height,duration",
                "-of", "json",
                str(clip_path),
            ]
            probe_run = subprocess.run(ffprobe_cmd, capture_output=True, text=True)
            self.assertEqual(probe_run.returncode, 0, f"ffprobe failed: {probe_run.stderr}")

            probe_data = json.loads(probe_run.stdout)
            streams = probe_data.get("streams", [])
            self.assertTrue(len(streams) > 0, "No video stream found in output")

            width = streams[0].get("width")
            height = streams[0].get("height")
            print(f"Output short dimensions: {width}x{height}")

            self.assertEqual(width, 1080, f"Expected width 1080, got {width}")
            self.assertEqual(height, 1920, f"Expected height 1920, got {height}")

            print(f"\n[OK] Pipeline verified end-to-end! Output: {clip_path.name}")


if __name__ == "__main__":
    unittest.main()

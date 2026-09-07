import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

import os
from click.testing import CliRunner
from fastapi.testclient import TestClient

from clipzilla.downloader import delete_source_video
from clipzilla.cli import main
from clipzilla.api.app import app
from clipzilla.api.database import init_db, create_job, get_job
from clipzilla.api.worker import process_job


class TestDeleteSourceAndOutput(unittest.TestCase):
    def setUp(self):
        self._temp_dir = tempfile.TemporaryDirectory()
        self._old_db = os.environ.get("CLIPZILLA_DB_PATH")
        os.environ["CLIPZILLA_DB_PATH"] = str(Path(self._temp_dir.name) / "test_delete_src.db")
        init_db()
        self.runner = CliRunner()
        self.client = TestClient(app)

    def tearDown(self):
        if self._old_db is not None:
            os.environ["CLIPZILLA_DB_PATH"] = self._old_db
        else:
            os.environ.pop("CLIPZILLA_DB_PATH", None)
        self._temp_dir.cleanup()

    def test_delete_source_video_files_and_preserves_metadata(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            video_dir = Path(tmpdir) / "test_vid"
            video_dir.mkdir()

            source_file = video_dir / "source.mp4"
            source_file.write_bytes(b"A" * 1024 * 100)  # 100 KB
            proxy_file = video_dir / "proxy.mp4"
            proxy_file.write_bytes(b"B" * 1024 * 20)   # 20 KB
            transcript_file = video_dir / "transcript.json"
            transcript_file.write_text('{"segments": []}', encoding="utf-8")
            meta_file = video_dir / "metadata.json"
            meta_file.write_text('{"id": "test_vid", "title": "Test Title"}', encoding="utf-8")

            res = delete_source_video(video_dir, delete_proxy=True)

            self.assertFalse(source_file.exists(), "source.mp4 should be deleted")
            self.assertFalse(proxy_file.exists(), "proxy.mp4 should be deleted")
            self.assertTrue(transcript_file.exists(), "transcript.json should be preserved")
            self.assertTrue(meta_file.exists(), "metadata.json should be preserved")

            self.assertIn("source.mp4", res["deleted_files"])
            self.assertIn("proxy.mp4", res["deleted_files"])
            self.assertEqual(res["freed_bytes"], 1024 * 120)

            # Check metadata was updated
            with open(meta_file, "r", encoding="utf-8") as f:
                updated_meta = json.load(f)
            self.assertTrue(updated_meta.get("source_deleted"))
            self.assertIsNone(updated_meta.get("video_path"))
            self.assertIsNone(updated_meta.get("proxy_path"))

    def test_cli_auto_with_output_dir_and_delete_source(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workdir = Path(tmpdir) / "workdir"
            workdir.mkdir()
            output_dir = Path(tmpdir) / "my_output"

            video_dir = workdir / "vidAutoTest"
            video_dir.mkdir()
            source_file = video_dir / "source.mp4"
            source_file.write_bytes(b"mock raw video data")
            (video_dir / "transcript.json").write_text("{}", encoding="utf-8")
            clips_suggested = [
                {
                    "start_time": 1.0,
                    "end_time": 10.0,
                    "title": "Clean Short",
                    "reason": "Top hook",
                }
            ]
            (video_dir / "clips_suggested.json").write_text(json.dumps(clips_suggested), encoding="utf-8")

            def mock_cut(video_dir, start, end, output_path, **kwargs):
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                Path(output_path).write_bytes(b"mock clip content")
                return Path(output_path)

            with patch("clipzilla.cli.download_video", return_value={"video_dir": video_dir, "video_id": "vidAutoTest"}), \
                 patch("clipzilla.cli.transcribe_video", return_value={}), \
                 patch("clipzilla.cli.run_analysis_for_video", return_value=video_dir / "clips_suggested.json"), \
                 patch("clipzilla.cli.cut_clip", side_effect=mock_cut), \
                 patch("clipzilla.cli.delete_source_video", wraps=delete_source_video) as mock_delete:

                result = self.runner.invoke(main, [
                    "auto",
                    "https://www.youtube.com/watch?v=sample",
                    "--workdir", str(workdir),
                    "--output-dir", str(output_dir),
                    "--delete-source",
                ])

                self.assertEqual(result.exit_code, 0, result.output)
                self.assertIn("ALL DONE", result.output)
                self.assertIn("Deleting original downloaded video", result.output)

                # Check clips are saved in custom output_dir
                generated_clips = list(output_dir.glob("*.mp4"))
                self.assertEqual(len(generated_clips), 1)
                self.assertTrue(generated_clips[0].name.startswith("clip_01_Clean_Short"))

                # Check delete was called and source file deleted
                mock_delete.assert_called_once()
                self.assertFalse(source_file.exists())

    def test_cli_auto_keep_source(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workdir = Path(tmpdir) / "workdir"
            workdir.mkdir()
            output_dir = Path(tmpdir) / "my_output"

            video_dir = workdir / "vidKeepTest"
            video_dir.mkdir()
            source_file = video_dir / "source.mp4"
            source_file.write_bytes(b"mock raw video data")
            (video_dir / "transcript.json").write_text("{}", encoding="utf-8")
            clips_suggested = [{"start_time": 0.0, "end_time": 5.0, "title": "Short", "reason": "hook"}]
            (video_dir / "clips_suggested.json").write_text(json.dumps(clips_suggested), encoding="utf-8")

            def mock_cut(video_dir, start, end, output_path, **kwargs):
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                Path(output_path).write_bytes(b"mock clip content")
                return Path(output_path)

            with patch("clipzilla.cli.download_video", return_value={"video_dir": video_dir, "video_id": "vidKeepTest"}), \
                 patch("clipzilla.cli.transcribe_video", return_value={}), \
                 patch("clipzilla.cli.run_analysis_for_video", return_value=video_dir / "clips_suggested.json"), \
                 patch("clipzilla.cli.cut_clip", side_effect=mock_cut), \
                 patch("clipzilla.cli.delete_source_video") as mock_delete:

                result = self.runner.invoke(main, [
                    "auto",
                    "https://www.youtube.com/watch?v=sample",
                    "--workdir", str(workdir),
                    "--output-dir", str(output_dir),
                    "--keep-source",
                ])

                self.assertEqual(result.exit_code, 0, result.output)
                mock_delete.assert_not_called()
                self.assertTrue(source_file.exists())

    def test_cli_clip_with_url_and_delete_source(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workdir = Path(tmpdir) / "workdir"
            workdir.mkdir()
            out_clip = Path(tmpdir) / "output" / "custom_cut.mp4"

            video_dir = workdir / "vidClipTest"
            video_dir.mkdir()
            source_file = video_dir / "source.mp4"
            source_file.write_bytes(b"raw video content")
            (video_dir / "transcript.json").write_text("{}", encoding="utf-8")

            def mock_cut(video_dir, start, end, output_path, **kwargs):
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                Path(output_path).write_bytes(b"cut content")
                return Path(output_path)

            with patch("clipzilla.cli.download_video", return_value={"video_dir": video_dir, "video_id": "vidClipTest"}), \
                 patch("clipzilla.cli.cut_clip", side_effect=mock_cut), \
                 patch("clipzilla.cli.delete_source_video", wraps=delete_source_video) as mock_delete:

                result = self.runner.invoke(main, [
                    "clip",
                    "https://www.youtube.com/watch?v=direct",
                    "--start", "5",
                    "--end", "20",
                    "--output", str(out_clip),
                    "--workdir", str(workdir),
                    "--delete-source",
                ])

                self.assertEqual(result.exit_code, 0, result.output)
                self.assertIn("Short created successfully", result.output)
                self.assertTrue(out_clip.exists())
                mock_delete.assert_called_once()
                self.assertFalse(source_file.exists())

    def test_api_submit_job_with_output_and_delete_source(self):
        with patch("clipzilla.api.app.enqueue_job"):
            res = self.client.post("/jobs", json={
                "url": "https://www.youtube.com/watch?v=test123",
                "output_dir": "custom_output_folder",
                "delete_source": True,
            })
            self.assertEqual(res.status_code, 201)
            job_data = res.json()
            job_id = job_data["id"]

            job_in_db = get_job(job_id)
            self.assertEqual(job_in_db["output_dir"], "custom_output_folder")
            self.assertEqual(job_in_db["delete_source"], 1)

    def test_worker_process_job_exports_to_output_and_cleans_source(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workdir = Path(tmpdir) / "workdir"
            workdir.mkdir()
            output_dir = Path(tmpdir) / "final_output"

            video_dir = workdir / "vidWorkerTest"
            video_dir.mkdir()
            source_file = video_dir / "source.mp4"
            source_file.write_bytes(b"source data")
            (video_dir / "transcript.json").write_text("{}", encoding="utf-8")
            (video_dir / "clips_suggested.json").write_text(
                json.dumps([{"start_time": 0.0, "end_time": 5.0, "title": "Worker Clip"}]),
                encoding="utf-8",
            )

            job = create_job(
                job_id="job_worker_test",
                url="https://youtube.com/worker",
                output_dir=str(output_dir),
                delete_source=True,
            )

            def mock_cut(video_dir, start, end, output_path, **kwargs):
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                Path(output_path).write_bytes(b"worker short content")
                return Path(output_path)

            with patch("clipzilla.api.worker.DEFAULT_WORKDIR", workdir), \
                 patch("clipzilla.api.worker.download_video", return_value={"video_dir": video_dir, "video_id": "vidWorkerTest"}), \
                 patch("clipzilla.api.worker.cut_clip", side_effect=mock_cut), \
                 patch("clipzilla.api.worker.generate_clip_thumbnail"), \
                 patch("clipzilla.api.worker.delete_source_video", wraps=delete_source_video) as mock_delete:

                process_job("job_worker_test")

                # Check job done
                updated_job = get_job("job_worker_test")
                self.assertEqual(updated_job["status"], "done")

                # Check output file in output_dir
                clips = list(output_dir.glob("*.mp4"))
                self.assertEqual(len(clips), 1)

                # Check source deleted
                mock_delete.assert_called_once()
                self.assertFalse(source_file.exists())

    def test_cli_auto_with_clips_count(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workdir = Path(tmpdir) / "workdir"
            workdir.mkdir()

            video_dir = workdir / "vidClipsCount"
            video_dir.mkdir()
            (video_dir / "source.mp4").write_bytes(b"data")
            (video_dir / "transcript.json").write_text("{}", encoding="utf-8")

            def mock_analysis_side_effect(*args, **kwargs):
                (video_dir / "clips_suggested.json").write_text(
                    json.dumps([{"start_time": 0.0, "end_time": 5.0, "title": "Clip 1"}]),
                    encoding="utf-8",
                )
                return video_dir / "clips_suggested.json"

            with patch("clipzilla.cli.download_video", return_value={"video_dir": video_dir, "video_id": "vidClipsCount"}), \
                 patch("clipzilla.cli.transcribe_video", return_value={}), \
                 patch("clipzilla.cli.run_analysis_for_video", side_effect=mock_analysis_side_effect) as mock_analysis, \
                 patch("clipzilla.cli.cut_clip", return_value=video_dir / "clips" / "clip_01_Clip_1.mp4"), \
                 patch("clipzilla.cli.delete_source_video", return_value={"deleted_files": ["source.mp4"], "freed_bytes": 1024 * 1024}):

                (video_dir / "clips").mkdir(parents=True, exist_ok=True)
                (video_dir / "clips" / "clip_01_Clip_1.mp4").write_bytes(b"content")

                result = self.runner.invoke(main, [
                    "auto",
                    "https://www.youtube.com/watch?v=sample",
                    "--workdir", str(workdir),
                    "--clips", "10",
                ])

                self.assertEqual(result.exit_code, 0, result.output)
                mock_analysis.assert_called_once()
                self.assertEqual(mock_analysis.call_args[1].get("num_clips"), 10)

    def test_api_submit_job_with_num_clips(self):
        with patch("clipzilla.api.app.enqueue_job"):
            res = self.client.post("/jobs", json={
                "url": "https://www.youtube.com/watch?v=testNumClips",
                "num_clips": 15,
            })
            self.assertEqual(res.status_code, 201)
            job_id = res.json()["id"]

            job_in_db = get_job(job_id)
            self.assertEqual(job_in_db["num_clips"], 15)


if __name__ == "__main__":
    unittest.main()

import unittest
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient

from clipzilla.api.app import app
from clipzilla.api.database import (
    init_db,
    create_job,
    add_clip,
    get_jobs_by_batch,
    get_clips_by_batch,
    get_project_history,
    delete_job,
)


class TestBatchAndHistory(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        init_db()

    def test_single_job_submission(self):
        """Tests standard single URL job submission."""
        payload = {
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "export_preset": "tiktok",
            "profile_id": "ollama_local",
        }
        res = self.client.post("/jobs", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn("id", data)
        self.assertEqual(data["export_preset"], "tiktok")
        self.assertEqual(data["profile_id"], "ollama_local")

    def test_batch_job_submission(self):
        """Tests submitting multiple URLs in batch mode."""
        payload = {
            "urls": [
                "https://www.youtube.com/watch?v=vid11111111",
                "https://www.youtube.com/watch?v=vid22222222",
            ],
            "export_preset": "instagram_reels",
            "profile_id": "ollama_local",
        }
        res = self.client.post("/jobs", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn("batch_id", data)
        self.assertEqual(data["count"], 2)
        self.assertEqual(len(data["jobs"]), 2)
        batch_id = data["batch_id"]

        # Verify querying batch status
        batch_res = self.client.get(f"/batches/{batch_id}")
        self.assertEqual(batch_res.status_code, 200)
        batch_status = batch_res.json()
        self.assertEqual(batch_status["total"], 2)

    def test_project_history_and_batch_clips(self):
        """Tests project history querying and aggregated clip counts."""
        job1 = create_job(
            job_id="job_hist_1",
            url="https://www.youtube.com/watch?v=hist1",
            batch_id="batch_hist",
            video_title="Awesome Talk 1",
            export_preset="youtube_shorts",
        )
        job2 = create_job(
            job_id="job_hist_2",
            url="https://www.youtube.com/watch?v=hist2",
            batch_id="batch_hist",
            video_title="Awesome Talk 2",
            export_preset="tiktok",
        )

        add_clip(
            clip_id="clip_hist_1",
            job_id="job_hist_1",
            video_id="hist1",
            title="Short 1",
            start_time=0.0,
            end_time=15.0,
            duration=15.0,
            reason="Good hook",
            needs_trimming=False,
            trimming_notes="",
            file_path="/tmp/fake1.mp4",
        )
        add_clip(
            clip_id="clip_hist_2",
            job_id="job_hist_1",
            video_id="hist1",
            title="Short 2",
            start_time=30.0,
            end_time=50.0,
            duration=20.0,
            reason="Climax",
            needs_trimming=False,
            trimming_notes="",
            file_path="/tmp/fake2.mp4",
        )

        # 1. Check history endpoint
        res = self.client.get("/history")
        self.assertEqual(res.status_code, 200)
        history = res.json()
        target = next((j for j in history if j["id"] == "job_hist_1"), None)
        self.assertIsNotNone(target)
        self.assertEqual(target["video_title"], "Awesome Talk 1")
        self.assertEqual(target["clip_count"], 2)

        # 2. Check batch clips endpoint
        b_clips_res = self.client.get("/batches/batch_hist/clips")
        self.assertEqual(b_clips_res.status_code, 200)
        b_clips = b_clips_res.json()
        self.assertEqual(len(b_clips), 2)
        self.assertEqual(b_clips[0]["video_title"], "Awesome Talk 1")

        # 3. Check delete job endpoint
        del_res = self.client.delete("/jobs/job_hist_1")
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json()["status"], "deleted")

    def test_presets_endpoint(self):
        """Tests the GET /presets endpoint."""
        res = self.client.get("/presets")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("youtube_shorts", data)
        self.assertIn("tiktok", data)
        self.assertIn("instagram_reels", data)


if __name__ == "__main__":
    unittest.main()

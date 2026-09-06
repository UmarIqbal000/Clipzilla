import unittest
import tempfile
import uuid
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

from clipzilla.api.app import app
from clipzilla.api.database import init_db, create_job, add_clip


class TestApi(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client = TestClient(app)

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["app"], "Clipzilla")

    def test_settings_get_and_post(self):
        # GET /settings
        get_res = self.client.get("/settings")
        self.assertEqual(get_res.status_code, 200)
        data = get_res.json()
        self.assertIn("provider", data)
        self.assertIn("providers", data)
        # Verify no raw secrets returned
        for p in data["providers"].values():
            self.assertNotIn("api_key", p)
            self.assertIn("has_api_key", p)

        # POST /settings
        post_res = self.client.post("/settings", json={
            "provider": "ollama_local",
            "providers": {
                "ollama_local": {
                    "base_url": "http://localhost:11434/v1",
                    "model": "llama3.2"
                }
            }
        })
        self.assertEqual(post_res.status_code, 200)
        updated = post_res.json()
        self.assertEqual(updated["provider"], "ollama_local")

    def test_create_and_poll_job(self):
        with patch("clipzilla.api.worker.enqueue_job"):
            res = self.client.post("/jobs", json={
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "preset": "single",
                "reframe": "auto",
            })
            self.assertEqual(res.status_code, 201)
            job = res.json()
            self.assertIn("id", job)
            self.assertEqual(job["status"], "queued")
            job_id = job["id"]

            # Poll GET /jobs/{id}
            poll_res = self.client.get(f"/jobs/{job_id}")
            self.assertEqual(poll_res.status_code, 200)
            self.assertEqual(poll_res.json()["id"], job_id)

    def test_get_job_clips_and_video(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            dummy_mp4 = Path(tmpdir) / "test_clip.mp4"
            dummy_mp4.write_bytes(b"dummy video data")

            dummy_jpg = Path(tmpdir) / "test_thumb.jpg"
            dummy_jpg.write_bytes(b"dummy image data")

            job_id = f"job_test_{uuid.uuid4().hex[:8]}"
            clip_id = f"clip_test_{uuid.uuid4().hex[:8]}"
            create_job(job_id, "https://youtube.com/test")
            add_clip(
                clip_id=clip_id,
                job_id=job_id,
                video_id="test_video",
                title="Amazing Moment",
                start_time=10.0,
                end_time=25.0,
                duration=15.0,
                reason="Viral hook",
                needs_trimming=False,
                trimming_notes="Clean",
                file_path=str(dummy_mp4),
                thumbnail_path=str(dummy_jpg),
            )

            # GET /jobs/{id}/clips
            clips_res = self.client.get(f"/jobs/{job_id}/clips")
            self.assertEqual(clips_res.status_code, 200)
            clips = clips_res.json()
            self.assertEqual(len(clips), 1)
            self.assertEqual(clips[0]["title"], "Amazing Moment")
            self.assertEqual(clips[0]["video_url"], f"/clips/{clip_id}/video")
            self.assertEqual(clips[0]["thumbnail_url"], f"/clips/{clip_id}/thumbnail")

            # GET /clips/{clip_id}/video
            vid_res = self.client.get(f"/clips/{clip_id}/video")
            self.assertEqual(vid_res.status_code, 200)
            self.assertEqual(vid_res.content, b"dummy video data")

            # GET /clips/{clip_id}/thumbnail
            thumb_res = self.client.get(f"/clips/{clip_id}/thumbnail")
            self.assertEqual(thumb_res.status_code, 200)
            self.assertEqual(thumb_res.content, b"dummy image data")


if __name__ == "__main__":
    unittest.main()

import os
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

from clipzilla.api.app import app
from clipzilla.api.database import (
    init_db,
    create_job,
    add_clip,
    create_social_account,
    get_social_account,
    list_social_accounts,
    update_social_account,
    delete_social_account,
    create_publish_job,
    get_publish_job,
    list_publish_jobs_for_clip,
    update_publish_job_status,
)
from clipzilla.api.credentials import encrypt_credentials, decrypt_credentials
from clipzilla.api.publishers import get_publisher, PUBLISHER_REGISTRY


class TestSocialPublishing(unittest.TestCase):
    def setUp(self):
        self._temp_dir = tempfile.TemporaryDirectory()
        self._old_db = os.environ.get("CLIPZILLA_DB_PATH")
        os.environ["CLIPZILLA_DB_PATH"] = str(Path(self._temp_dir.name) / "test_social.db")
        init_db()
        self.client = TestClient(app)

    def tearDown(self):
        if self._old_db is not None:
            os.environ["CLIPZILLA_DB_PATH"] = self._old_db
        else:
            os.environ.pop("CLIPZILLA_DB_PATH", None)
        self._temp_dir.cleanup()

    def test_credentials_encryption_roundtrip(self):
        sample_creds = {
            "access_token": "ya29.sample_oauth_token_12345",
            "refresh_token": "1//sample_refresh_token_abcde",
            "expires_in": 3600,
            "client_id": "test_client_id.apps.googleusercontent.com"
        }
        encrypted = encrypt_credentials(sample_creds)
        self.assertIsInstance(encrypted, str)
        self.assertNotEqual(encrypted, str(sample_creds))

        decrypted = decrypt_credentials(encrypted)
        self.assertEqual(decrypted, sample_creds)

    def test_publisher_registry(self):
        self.assertIn("youtube", PUBLISHER_REGISTRY)
        self.assertIn("instagram", PUBLISHER_REGISTRY)
        self.assertIn("facebook", PUBLISHER_REGISTRY)
        self.assertNotIn("tiktok", PUBLISHER_REGISTRY)

        yt = get_publisher("youtube")
        self.assertEqual(yt.platform, "youtube")

        ig = get_publisher("instagram")
        self.assertEqual(ig.platform, "instagram")

        fb = get_publisher("facebook")
        self.assertEqual(fb.platform, "facebook")

        with self.assertRaises(ValueError):
            get_publisher("tiktok")

    def test_social_accounts_crud(self):
        acc_id = str(uuid.uuid4())
        encrypted = encrypt_credentials({"access_token": "token_xyz"})

        # Create
        create_social_account(
            account_id=acc_id,
            platform="youtube",
            account_name="Tech Channel",
            account_handle="tech_guy",
            credentials=encrypted,
            scopes="https://www.googleapis.com/auth/youtube.upload",
        )

        # Get
        acc = get_social_account(acc_id)
        self.assertIsNotNone(acc)
        self.assertEqual(acc["account_name"], "Tech Channel")
        self.assertEqual(acc["platform"], "youtube")
        self.assertEqual(acc["is_active"], 1)

        # List
        accounts = list_social_accounts()
        self.assertTrue(any(a["id"] == acc_id for a in accounts))

        # Update
        update_social_account(acc_id, account_name="Updated Tech Channel", is_active=0)
        updated = get_social_account(acc_id)
        self.assertEqual(updated["account_name"], "Updated Tech Channel")
        self.assertEqual(updated["is_active"], 0)

        # Delete
        delete_social_account(acc_id)
        self.assertIsNone(get_social_account(acc_id))

    def test_publish_jobs_crud_and_status(self):
        job_id = str(uuid.uuid4())
        clip_id = str(uuid.uuid4())
        acc_id = str(uuid.uuid4())
        pub_id = str(uuid.uuid4())

        # Setup parent job and clip
        create_job(job_id=job_id, url="https://youtube.com/watch?v=123")
        add_clip(
            clip_id=clip_id,
            job_id=job_id,
            video_id="123",
            title="Awesome Clip",
            start_time=10.0,
            end_time=30.0,
            duration=20.0,
            reason="High hook retention",
            needs_trimming=False,
            trimming_notes="",
            file_path="output/clip.mp4"
        )
        create_social_account(
            account_id=acc_id,
            platform="instagram",
            account_name="Insta Profile",
            account_handle="insta_user",
            credentials=encrypt_credentials({"access_token": "tok"})
        )

        # Create publish job
        create_publish_job(
            job_id=pub_id,
            clip_id=clip_id,
            account_id=acc_id,
            platform="instagram",
            title="Post Title",
            description="Post Description",
            tags="#viral, #reels"
        )

        pub_job = get_publish_job(pub_id)
        self.assertIsNotNone(pub_job)
        self.assertEqual(pub_job["status"], "queued")
        self.assertEqual(pub_job["progress"], 0)

        # Update status
        update_publish_job_status(
            pub_id,
            status="published",
            progress=100,
            stage_message="Successfully posted.",
            platform_post_id="post_999",
            platform_post_url="https://instagram.com/p/999"
        )

        updated_pub = get_publish_job(pub_id)
        self.assertEqual(updated_pub["status"], "published")
        self.assertEqual(updated_pub["progress"], 100)
        self.assertEqual(updated_pub["stage_message"], "Successfully posted.")
        self.assertEqual(updated_pub["platform_post_id"], "post_999")
        self.assertEqual(updated_pub["platform_post_url"], "https://instagram.com/p/999")

        # List for clip
        clip_jobs = list_publish_jobs_for_clip(clip_id)
        self.assertEqual(len(clip_jobs), 1)
        self.assertEqual(clip_jobs[0]["id"], pub_id)

    @patch("clipzilla.api.app.enqueue_publish")
    def test_publish_api_endpoints(self, mock_enqueue):
        # 1. Create clip and account
        job_id = str(uuid.uuid4())
        clip_id = str(uuid.uuid4())
        acc_id = str(uuid.uuid4())

        create_job(job_id=job_id, url="https://youtube.com/watch?v=abc")
        add_clip(
            clip_id=clip_id,
            job_id=job_id,
            video_id="abc",
            title="Short Reel",
            start_time=0.0,
            end_time=15.0,
            duration=15.0,
            reason="Punchy opener",
            needs_trimming=False,
            trimming_notes="",
            file_path="output/short.mp4"
        )
        create_social_account(
            account_id=acc_id,
            platform="youtube",
            account_name="My Channel",
            account_handle="my_chan",
            credentials=encrypt_credentials({"access_token": "secret_token"})
        )

        # 2. GET /social-accounts (no secrets exposed)
        res = self.client.get("/social-accounts")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["account_name"], "My Channel")
        self.assertNotIn("credentials", data[0])

        # 3. PATCH /social-accounts/{id}
        patch_res = self.client.patch(f"/social-accounts/{acc_id}", json={"account_name": "Renamed Channel"})
        self.assertEqual(patch_res.status_code, 200)
        get_res = self.client.get(f"/social-accounts/{acc_id}")
        self.assertEqual(get_res.json()["account_name"], "Renamed Channel")

        # 4. OAuth start endpoint
        with patch.dict(os.environ, {"YOUTUBE_CLIENT_ID": "mock_client_id_123", "YOUTUBE_CLIENT_SECRET": "mock_secret"}):
            oauth_start = self.client.get("/social-accounts/oauth/youtube/start")
            self.assertEqual(oauth_start.status_code, 200)
            self.assertIn("auth_url", oauth_start.json())
            self.assertIn("url", oauth_start.json())

        # 5. POST /clips/{clip_id}/publish
        publish_res = self.client.post(f"/clips/{clip_id}/publish", json={
            "account_ids": [acc_id],
            "title": "Viral YouTube Short",
            "description": "Watch this!",
            "tags": "#shorts, #viral",
            "privacy": "public"
        })
        self.assertEqual(publish_res.status_code, 200)
        pub_data = publish_res.json()
        self.assertEqual(pub_data["count"], 1)
        self.assertTrue(len(pub_data["job_ids"]) > 0)
        mock_enqueue.assert_called_once()

        pub_job_id = pub_data["job_ids"][0]

        # 6. GET /publish-jobs/{job_id}
        status_res = self.client.get(f"/publish-jobs/{pub_job_id}")
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(status_res.json()["status"], "queued")
        self.assertEqual(status_res.json()["account_name"], "Renamed Channel")

        # 7. GET /clips/{clip_id}/publish-history
        history_res = self.client.get(f"/clips/{clip_id}/publish-history")
        self.assertEqual(history_res.status_code, 200)
        hist_data = history_res.json()
        self.assertEqual(len(hist_data), 1)
        self.assertEqual(hist_data[0]["title"], "Viral YouTube Short")

        # 8. DELETE /social-accounts/{id}
        del_res = self.client.delete(f"/social-accounts/{acc_id}")
        self.assertEqual(del_res.status_code, 200)
        empty_res = self.client.get("/social-accounts")
        self.assertEqual(len(empty_res.json()), 0)

    def test_credentials_status_and_save(self):
        # 1. Check status endpoint when env has mock values
        with patch.dict(os.environ, {
            "YOUTUBE_CLIENT_ID": "1234567890-youtube-app.apps.googleusercontent.com",
            "YOUTUBE_CLIENT_SECRET": "GOCSPX-secret123",
            "META_APP_ID": "9876543210",
            "META_APP_SECRET": "meta_secret_hash",
            "AWS_ACCESS_KEY_ID": "AKIA12345678EXAMPLE",
            "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "CLIPZILLA_S3_BUCKET": "my-clip-bucket",
            "CLIPZILLA_S3_REGION": "us-west-2"
        }):
            status_res = self.client.get("/social-accounts/credentials/status")
            self.assertEqual(status_res.status_code, 200)
            data = status_res.json()

            self.assertTrue(data["youtube"]["has_credentials"])
            self.assertTrue(data["youtube"]["has_client_id"])
            self.assertTrue(data["youtube"]["has_client_secret"])
            self.assertIn("...", data["youtube"]["client_id_preview"])

            self.assertTrue(data["meta"]["has_credentials"])
            self.assertTrue(data["meta"]["has_app_id"])
            self.assertTrue(data["meta"]["has_app_secret"])
            self.assertIn("...", data["meta"]["app_id_preview"])

            self.assertTrue(data["aws"]["has_credentials"])
            self.assertEqual(data["aws"]["s3_bucket"], "my-clip-bucket")
            self.assertEqual(data["aws"]["s3_region"], "us-west-2")

        # 2. Test saving credentials via POST /social-accounts/credentials
        mock_env_file = Path(self._temp_dir.name) / ".test_env"
        mock_env_file.touch()
        with patch("clipzilla.api.settings.ENV_PATH", mock_env_file):
            save_payload = {
                "youtube_client_id": "new_yt_client_id",
                "youtube_client_secret": "new_yt_secret",
                "meta_app_id": "new_meta_id",
                "meta_app_secret": "new_meta_secret",
                "aws_access_key_id": "new_aws_key",
                "aws_secret_access_key": "new_aws_secret",
                "aws_s3_bucket": "new-test-bucket",
                "aws_s3_region": "eu-central-1"
            }
            save_res = self.client.post("/social-accounts/credentials", json=save_payload)
            self.assertEqual(save_res.status_code, 200)
            save_data = save_res.json()
            self.assertEqual(save_data["status"], "saved")
            self.assertIn("YOUTUBE_CLIENT_ID", save_data["updated"])
            self.assertIn("CLIPZILLA_S3_BUCKET", save_data["updated"])

            # Verify values in memory
            self.assertEqual(os.environ.get("YOUTUBE_CLIENT_ID"), "new_yt_client_id")
            self.assertEqual(os.environ.get("CLIPZILLA_S3_BUCKET"), "new-test-bucket")

    def test_direct_connect_endpoints(self):
        # 1. Connect YouTube account directly
        yt_res = self.client.post("/social-accounts/direct-connect", json={
            "platform": "youtube",
            "account_name": "Direct YT Creator",
            "account_handle": "creator_channel",
            "access_token": "ya29.direct_access_token",
            "refresh_token": "1//direct_refresh_token",
            "expires_in": 3600
        })
        self.assertEqual(yt_res.status_code, 200)
        yt_data = yt_res.json()
        self.assertEqual(yt_data["status"], "connected")
        self.assertEqual(yt_data["platform"], "youtube")
        yt_id = yt_data["account_id"]

        # Verify DB storage and decryption
        yt_account = get_social_account(yt_id)
        self.assertIsNotNone(yt_account)
        decrypted_yt = decrypt_credentials(yt_account["credentials"])
        self.assertEqual(decrypted_yt["access_token"], "ya29.direct_access_token")
        self.assertEqual(decrypted_yt["refresh_token"], "1//direct_refresh_token")

        # 2. Connect Instagram account directly
        ig_res = self.client.post("/social-accounts/direct-connect", json={
            "platform": "instagram",
            "account_name": "Insta Creator Brand",
            "account_handle": "brand_official",
            "access_token": "IGQVJ_token_abc",
            "ig_user_id": "17841400011223344"
        })
        self.assertEqual(ig_res.status_code, 200)
        ig_data = ig_res.json()
        ig_id = ig_data["account_id"]

        ig_account = get_social_account(ig_id)
        decrypted_ig = decrypt_credentials(ig_account["credentials"])
        self.assertEqual(decrypted_ig["ig_user_id"], "17841400011223344")

        # 3. Connect Facebook account directly
        fb_res = self.client.post("/social-accounts/direct-connect", json={
            "platform": "facebook",
            "account_name": "Official Facebook Page",
            "page_id": "100200300400",
            "page_access_token": "EAAB_fb_page_token"
        })
        self.assertEqual(fb_res.status_code, 200)
        fb_data = fb_res.json()
        fb_id = fb_data["account_id"]

        fb_account = get_social_account(fb_id)
        decrypted_fb = decrypt_credentials(fb_account["credentials"])
        self.assertEqual(decrypted_fb["page_id"], "100200300400")

        # 4. Error case: unsupported platform (e.g. TikTok)
        tiktok_res = self.client.post("/social-accounts/direct-connect", json={
            "platform": "tiktok",
            "account_name": "TikToker",
            "access_token": "tok"
        })
        self.assertEqual(tiktok_res.status_code, 400)
        self.assertIn("Unsupported platform", tiktok_res.json()["detail"])

        # 5. Error case: missing required tokens for Instagram
        bad_ig_res = self.client.post("/social-accounts/direct-connect", json={
            "platform": "instagram",
            "account_name": "Bad IG",
            "access_token": "only_token_no_user_id"
        })
        self.assertEqual(bad_ig_res.status_code, 400)
        self.assertIn("ig_user_id", bad_ig_res.json()["detail"])


if __name__ == "__main__":
    unittest.main()


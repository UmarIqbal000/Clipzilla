"""Facebook publisher integration using the Meta Graph API."""
import os
import logging
import httpx
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlencode

from clipzilla.api.publishers.base import BasePlatformPublisher

logger = logging.getLogger('clipzilla.api.publishers.facebook')

GRAPH_API_VERSION = "v21.0"
GRAPH_BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"
VIDEO_CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB chunks


class FacebookPublisher(BasePlatformPublisher):
    """Facebook Page publisher for uploading videos via Meta Graph API."""
    
    platform = "facebook"

    @property
    def client_id(self) -> str:
        return os.environ.get("META_APP_ID", "")

    @property
    def client_secret(self) -> str:
        return os.environ.get("META_APP_SECRET", "")

    def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        if not self.client_id:
            raise ValueError("META_APP_ID environment variable is not set")
            
        scopes = "publish_video,pages_manage_posts,pages_read_engagement"
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": scopes,
            "response_type": "code"
        }
        return f"https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth?{urlencode(params)}"

    def complete_oauth(self, auth_code: str, redirect_uri: str) -> dict:
        """Exchanges code for a long-lived user token and extracts a Page access token."""
        # 1. Exchange for short-lived token
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "client_secret": self.client_secret,
            "code": auth_code
        }
        resp = httpx.get(f"{GRAPH_BASE_URL}/oauth/access_token", params=params)
        resp.raise_for_status()
        token_data = resp.json()
        short_token = token_data["access_token"]
        
        # 2. Exchange for long-lived token
        long_params = {
            "grant_type": "fb_exchange_token",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "fb_exchange_token": short_token
        }
        long_resp = httpx.get(f"{GRAPH_BASE_URL}/oauth/access_token", params=long_params)
        long_resp.raise_for_status()
        long_token_data = long_resp.json()
        long_token = long_token_data["access_token"]
        
        # 3. Get Pages user manages
        accounts_resp = httpx.get(
            f"{GRAPH_BASE_URL}/me/accounts",
            params={"access_token": long_token}
        )
        accounts_resp.raise_for_status()
        accounts_data = accounts_resp.json().get("data", [])
        
        if not accounts_data:
            raise ValueError("No Facebook Pages found for this account.")
            
        # Default to the first page returned
        page = accounts_data[0]
        page_id = page["id"]
        page_access_token = page["access_token"]
        page_name = page.get("name", "")
        
        creds = {
            "user_access_token": long_token,
            "page_access_token": page_access_token,
            "page_id": page_id,
            "scopes": ["publish_video", "pages_manage_posts", "pages_read_engagement"]
        }
        
        # 4. Fetch Page Profile Info
        info = self.get_account_info(creds)
        creds.update(info)
        
        return creds

    def refresh_token(self, credentials: dict) -> dict:
        """Refreshes a long-lived Facebook user access token."""
        token = credentials.get("user_access_token")
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "fb_exchange_token": token
        }
        resp = httpx.get(f"{GRAPH_BASE_URL}/oauth/access_token", params=params)
        resp.raise_for_status()
        token_data = resp.json()
        
        updated_creds = credentials.copy()
        new_user_token = token_data.get("access_token", token)
        updated_creds["user_access_token"] = new_user_token
        
        # Re-fetch page token
        if new_user_token != token:
            accounts_resp = httpx.get(
                f"{GRAPH_BASE_URL}/me/accounts",
                params={"access_token": new_user_token}
            )
            if accounts_resp.status_code == 200:
                accounts_data = accounts_resp.json().get("data", [])
                for page in accounts_data:
                    if page["id"] == credentials.get("page_id"):
                        updated_creds["page_access_token"] = page["access_token"]
                        break

        return updated_creds

    def upload_video(self, video_path: Path, metadata: dict, credentials: dict,
                     on_progress: Optional[Callable[[int], None]] = None) -> dict:
        """Uploads a video to a Facebook Page using resumable upload."""
        page_id = credentials.get("page_id")
        page_token = credentials.get("page_access_token")
        
        if not page_id or not page_token:
            raise ValueError("Facebook page_id or page_access_token missing from credentials.")
            
        file_size = video_path.stat().st_size
        logger.info(f"Starting Facebook Page upload for {video_path} ({file_size} bytes)")
        
        # 1. Start Phase
        start_payload = {
            "upload_phase": "start",
            "file_size": file_size,
            "access_token": page_token
        }
        start_resp = httpx.post(f"{GRAPH_BASE_URL}/{page_id}/videos", data=start_payload)
        start_resp.raise_for_status()
        start_data = start_resp.json()
        
        upload_session_id = start_data.get("upload_session_id")
        video_id = start_data.get("video_id")
        start_offset = int(start_data.get("start_offset", 0))
        end_offset = int(start_data.get("end_offset", file_size))
        
        if not upload_session_id:
            raise RuntimeError("Failed to start Facebook video upload session.")
            
        # 2. Transfer Phase
        with open(video_path, "rb") as f:
            while start_offset < file_size:
                f.seek(start_offset)
                chunk_size = end_offset - start_offset
                chunk_data = f.read(chunk_size)
                
                transfer_payload = {
                    "upload_phase": "transfer",
                    "upload_session_id": upload_session_id,
                    "access_token": page_token,
                    "start_offset": start_offset
                }
                
                files = {
                    "video_file_chunk": (video_path.name, chunk_data, "video/mp4")
                }
                
                transfer_resp = httpx.post(
                    f"{GRAPH_BASE_URL}/{page_id}/videos",
                    data=transfer_payload,
                    files=files
                )
                transfer_resp.raise_for_status()
                transfer_data = transfer_resp.json()
                
                start_offset = int(transfer_data.get("start_offset", start_offset))
                end_offset = int(transfer_data.get("end_offset", file_size))
                
                if on_progress:
                    progress = int((start_offset / file_size) * 90)
                    on_progress(progress)
                    
        # 3. Finish Phase
        logger.info("Finishing Facebook upload session...")
        title = metadata.get("title", "")
        desc = metadata.get("description", "")
        
        finish_payload = {
            "upload_phase": "finish",
            "upload_session_id": upload_session_id,
            "access_token": page_token,
            "title": title,
            "description": desc
        }
        
        finish_resp = httpx.post(f"{GRAPH_BASE_URL}/{page_id}/videos", data=finish_payload)
        finish_resp.raise_for_status()
        
        if on_progress:
            on_progress(100)
            
        logger.info(f"Successfully uploaded video to Facebook Page: {video_id}")
        
        return {
            "platform_post_id": video_id,
            "platform_post_url": f"https://www.facebook.com/video.php?v={video_id}"
        }

    def get_account_info(self, credentials: dict) -> dict:
        """Fetches Facebook Page name and picture."""
        page_id = credentials.get("page_id")
        page_token = credentials.get("page_access_token")
        
        if not page_id or not page_token:
            raise ValueError("Facebook page_id or page_access_token missing.")
            
        resp = httpx.get(
            f"{GRAPH_BASE_URL}/{page_id}",
            params={"fields": "name,picture", "access_token": page_token}
        )
        resp.raise_for_status()
        data = resp.json()
        
        picture_url = ""
        if "picture" in data and "data" in data["picture"]:
            picture_url = data["picture"]["data"].get("url", "")
            
        return {
            "account_name": data.get("name", ""),
            "account_handle": data.get("name", ""),
            "avatar_url": picture_url
        }

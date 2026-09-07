"""Instagram publisher integration using the Meta Graph API."""
import os
import time
import logging
import httpx
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlencode

from clipzilla.api.publishers.base import BasePlatformPublisher

logger = logging.getLogger('clipzilla.api.publishers.instagram')

GRAPH_API_VERSION = "v21.0"
GRAPH_BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


class InstagramPublisher(BasePlatformPublisher):
    """Instagram publisher for uploading Reels via Meta Graph API."""
    
    platform = "instagram"

    @property
    def client_id(self) -> str:
        return os.environ.get("META_APP_ID", "")

    @property
    def client_secret(self) -> str:
        return os.environ.get("META_APP_SECRET", "")

    def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        if not self.client_id:
            raise ValueError("META_APP_ID environment variable is not set")
            
        scopes = "instagram_content_publish,instagram_basic,pages_read_engagement"
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": scopes,
            "response_type": "code"
        }
        return f"https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth?{urlencode(params)}"

    def complete_oauth(self, auth_code: str, redirect_uri: str) -> dict:
        """Exchanges code for a long-lived access token and fetches account details."""
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
        access_token = long_token_data["access_token"]
        expires_in = long_token_data.get("expires_in")
        
        # 3. Get Instagram Business Account ID
        accounts_resp = httpx.get(
            f"{GRAPH_BASE_URL}/me/accounts",
            params={"fields": "instagram_business_account", "access_token": access_token}
        )
        accounts_resp.raise_for_status()
        accounts_data = accounts_resp.json().get("data", [])
        
        ig_user_id = None
        for page in accounts_data:
            if "instagram_business_account" in page:
                ig_user_id = page["instagram_business_account"]["id"]
                break
                
        if not ig_user_id:
            raise ValueError("No linked Instagram Business Account found.")
            
        creds = {
            "access_token": access_token,
            "ig_user_id": ig_user_id,
            "expires_in": expires_in,
            "scopes": ["instagram_content_publish", "instagram_basic", "pages_read_engagement"]
        }
        
        # 4. Fetch Profile Info
        info = self.get_account_info(creds)
        creds.update(info)
        
        return creds

    def refresh_token(self, credentials: dict) -> dict:
        """Refreshes a long-lived Facebook access token."""
        token = credentials.get("access_token")
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
        updated_creds["access_token"] = token_data.get("access_token", token)
        if "expires_in" in token_data:
            updated_creds["expires_in"] = token_data["expires_in"]
            
        return updated_creds

    def upload_video(self, video_path: Path, metadata: dict, credentials: dict,
                     on_progress: Optional[Callable[[int], None]] = None) -> dict:
        """Uploads a Reel to Instagram using a public URL."""
        video_url = metadata.get("video_url")
        if not video_url:
            raise ValueError("Instagram Graph API requires a public 'video_url' in metadata.")
            
        ig_user_id = credentials.get("ig_user_id")
        access_token = credentials.get("access_token")
        
        title = metadata.get("title", "")
        tags = " ".join([f"#{tag}" for tag in metadata.get("tags", [])])
        caption = f"{title}\n\n{tags}".strip()
        
        logger.info(f"Initiating Instagram Reel upload for {ig_user_id}")
        
        # 1. Create Media Container
        container_payload = {
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "access_token": access_token
        }
        
        container_resp = httpx.post(
            f"{GRAPH_BASE_URL}/{ig_user_id}/media",
            data=container_payload
        )
        container_resp.raise_for_status()
        container_id = container_resp.json().get("id")
        
        if not container_id:
            raise RuntimeError("Failed to create Instagram media container.")
            
        if on_progress:
            on_progress(20)
            
        # 2. Poll for FINISHED status
        status_url = f"{GRAPH_BASE_URL}/{container_id}"
        poll_interval = 10
        max_attempts = 30  # 5 minutes max
        
        logger.info(f"Polling Instagram container {container_id} status...")
        is_finished = False
        
        for attempt in range(max_attempts):
            status_resp = httpx.get(
                status_url,
                params={"fields": "status_code", "access_token": access_token}
            )
            status_resp.raise_for_status()
            status_code = status_resp.json().get("status_code")
            
            logger.debug(f"Container status: {status_code}")
            
            if status_code == "FINISHED":
                is_finished = True
                break
            elif status_code == "ERROR":
                raise RuntimeError("Instagram video processing failed.")
                
            if on_progress:
                # Progress from 20 to 80 while polling
                progress = min(80, 20 + int((attempt / max_attempts) * 60))
                on_progress(progress)
                
            time.sleep(poll_interval)
            
        if not is_finished:
            raise TimeoutError("Timed out waiting for Instagram video to process.")
            
        if on_progress:
            on_progress(90)
            
        # 3. Publish the Container
        logger.info(f"Publishing Instagram container {container_id}...")
        publish_payload = {
            "creation_id": container_id,
            "access_token": access_token
        }
        
        publish_resp = httpx.post(
            f"{GRAPH_BASE_URL}/{ig_user_id}/media_publish",
            data=publish_payload
        )
        publish_resp.raise_for_status()
        media_id = publish_resp.json().get("id")
        
        if on_progress:
            on_progress(100)
            
        logger.info(f"Successfully published Reel to Instagram: {media_id}")
        
        # NOTE: Instagram API does not return a direct post URL, construct a generic or id-based one
        return {
            "platform_post_id": media_id,
            "platform_post_url": f"https://www.instagram.com/reel/{media_id}/"
        }

    def get_account_info(self, credentials: dict) -> dict:
        """Fetches Instagram account username and profile picture."""
        ig_user_id = credentials.get("ig_user_id")
        access_token = credentials.get("access_token")
        
        if not ig_user_id:
            raise ValueError("ig_user_id is missing from credentials.")
            
        resp = httpx.get(
            f"{GRAPH_BASE_URL}/{ig_user_id}",
            params={"fields": "username,profile_picture_url", "access_token": access_token}
        )
        resp.raise_for_status()
        data = resp.json()
        
        return {
            "account_name": data.get("username", ""),
            "account_handle": data.get("username", ""),
            "avatar_url": data.get("profile_picture_url", "")
        }

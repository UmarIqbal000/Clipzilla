"""YouTube publisher integration using the YouTube Data API v3."""
import os
import logging
import httpx
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlencode

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from clipzilla.api.publishers.base import BasePlatformPublisher

logger = logging.getLogger('clipzilla.api.publishers.youtube')


class YouTubePublisher(BasePlatformPublisher):
    """YouTube publisher for uploading videos to a user's channel."""
    
    platform = "youtube"
    
    @property
    def client_id(self) -> str:
        return os.environ.get("YOUTUBE_CLIENT_ID", "")

    @property
    def client_secret(self) -> str:
        return os.environ.get("YOUTUBE_CLIENT_SECRET", "")

    def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        """Returns the OAuth authorization URL."""
        if not self.client_id:
            raise ValueError("YOUTUBE_CLIENT_ID environment variable is not set")
            
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
            "access_type": "offline",
            "prompt": "consent",
            "state": state
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    def complete_oauth(self, auth_code: str, redirect_uri: str) -> dict:
        """Exchanges the authorization code for tokens."""
        data = {
            "code": auth_code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        }
        
        response = httpx.post("https://oauth2.googleapis.com/token", data=data)
        response.raise_for_status()
        token_data = response.json()
        
        creds_dict = {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in"),
            "scopes": token_data.get("scope", "").split(),
        }
        
        # Fetch account info to return along with tokens
        account_info = self.get_account_info(creds_dict)
        creds_dict.update(account_info)
        
        return creds_dict

    def refresh_token(self, credentials: dict) -> dict:
        """Refreshes an expired access token."""
        refresh_token = credentials.get("refresh_token")
        if not refresh_token:
            raise ValueError("No refresh token available.")
            
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        
        response = httpx.post("https://oauth2.googleapis.com/token", data=data)
        response.raise_for_status()
        token_data = response.json()
        
        updated_creds = credentials.copy()
        updated_creds["access_token"] = token_data.get("access_token")
        if "refresh_token" in token_data:
            updated_creds["refresh_token"] = token_data["refresh_token"]
        updated_creds["expires_in"] = token_data.get("expires_in")
        
        return updated_creds

    def upload_video(self, video_path: Path, metadata: dict, credentials: dict,
                     on_progress: Optional[Callable[[int], None]] = None) -> dict:
        """Uploads a video to YouTube."""
        logger.info(f"Starting YouTube upload for {video_path}")
        
        creds = Credentials(
            token=credentials["access_token"],
            refresh_token=credentials.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret
        )
        
        youtube = build("youtube", "v3", credentials=creds)
        
        title = metadata.get("title", "Untitled Video")
        duration = metadata.get("duration", 0)
        
        # If duration < 60s, add #Shorts to the title if not present
        if duration < 60 and "#Shorts" not in title:
            title = f"{title} #Shorts"
            
        privacy_status = metadata.get("privacy", "private").lower()
        if privacy_status not in ["public", "private", "unlisted"]:
            privacy_status = "private"
            
        body = {
            "snippet": {
                "title": title,
                "description": metadata.get("description", ""),
                "tags": metadata.get("tags", []),
                "categoryId": "22"  # People & Blogs as default
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False
            }
        }
        
        media = MediaFileUpload(str(video_path), chunksize=-1, resumable=True)
        request = youtube.videos().insert(
            part=",".join(body.keys()),
            body=body,
            media_body=media
        )
        
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status and on_progress:
                progress = int(status.progress() * 100)
                on_progress(progress)
                
        video_id = response.get("id")
        if not video_id:
            raise RuntimeError("YouTube upload failed: No video ID returned.")
            
        logger.info(f"Successfully uploaded YouTube video: {video_id}")
        return {
            "platform_post_id": video_id,
            "platform_post_url": f"https://www.youtube.com/watch?v={video_id}"
        }

    def get_account_info(self, credentials: dict) -> dict:
        """Fetches current channel info."""
        creds = Credentials(
            token=credentials["access_token"],
            refresh_token=credentials.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret
        )
        
        youtube = build("youtube", "v3", credentials=creds)
        request = youtube.channels().list(part="snippet", mine=True)
        response = request.execute()
        
        items = response.get("items", [])
        if not items:
            raise ValueError("No YouTube channel found for this account.")
            
        channel = items[0]
        snippet = channel.get("snippet", {})
        
        return {
            "account_name": snippet.get("title", ""),
            "account_handle": snippet.get("customUrl", ""),
            "avatar_url": snippet.get("thumbnails", {}).get("default", {}).get("url", "")
        }

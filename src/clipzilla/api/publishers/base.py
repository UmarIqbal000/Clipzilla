"""Abstract base class for platform publishers."""
import abc
from pathlib import Path
from typing import Callable, Optional


class BasePlatformPublisher(abc.ABC):
    """Base class for social media platform publishers."""
    
    platform: str = ""
    
    @abc.abstractmethod
    def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        """Returns the OAuth authorization URL to open in the user's browser."""
    
    @abc.abstractmethod
    def complete_oauth(self, auth_code: str, redirect_uri: str) -> dict:
        """Exchanges the authorization code for tokens.
        
        Returns:
            dict: {access_token, refresh_token, expires_in, account_name, account_handle, avatar_url, scopes}
        """
    
    @abc.abstractmethod
    def refresh_token(self, credentials: dict) -> dict:
        """Refreshes an expired access token.
        
        Args:
            credentials (dict): The current credentials containing the refresh token.
            
        Returns:
            dict: Updated credentials dict.
        """
    
    @abc.abstractmethod
    def upload_video(self, video_path: Path, metadata: dict, credentials: dict,
                     on_progress: Optional[Callable[[int], None]] = None) -> dict:
        """Uploads a video to the platform.
        
        Args:
            video_path (Path): Path to the video file to upload.
            metadata (dict): keys: title, description, tags (list), privacy ('public'/'private'/'unlisted').
                             May also contain 'duration' or 'video_url' depending on the publisher.
            credentials (dict): OAuth credentials to use for the upload.
            on_progress (Optional[Callable[[int], None]]): callback receiving progress percentage (0-100).
            
        Returns:
            dict: {platform_post_id, platform_post_url}
        """
    
    @abc.abstractmethod
    def get_account_info(self, credentials: dict) -> dict:
        """Fetches current account info.
        
        Args:
            credentials (dict): The OAuth credentials to use.
            
        Returns:
            dict: {account_name, account_handle, avatar_url}
        """

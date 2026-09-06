from typing import Dict, Any, Optional

EXPORT_PRESETS: Dict[str, Dict[str, Any]] = {
    "youtube_shorts": {
        "id": "youtube_shorts",
        "name": "YouTube Shorts",
        "aspect_ratio": "9:16",
        "max_duration": 180.0,  # 3 minutes
        "width": 1080,
        "height": 1920,
        "video_bitrate": "10M",
        "audio_bitrate": "192k",
        "description": "9:16 vertical • Up to 3 min • 10 Mbps default",
    },
    "tiktok": {
        "id": "tiktok",
        "name": "TikTok",
        "aspect_ratio": "9:16",
        "max_duration": 600.0,  # 10 minutes
        "width": 1080,
        "height": 1920,
        "video_bitrate": "12M",
        "audio_bitrate": "192k",
        "description": "9:16 vertical • Up to 10 min • 12 Mbps high-bitrate",
    },
    "instagram_reels": {
        "id": "instagram_reels",
        "name": "Instagram Reels",
        "aspect_ratio": "9:16",
        "max_duration": 180.0,  # 3 minutes
        "width": 1080,
        "height": 1920,
        "video_bitrate": "8M",
        "audio_bitrate": "192k",
        "description": "9:16 vertical • Up to 3 min • 8 Mbps default",
    },
}

DEFAULT_EXPORT_PRESET = "youtube_shorts"


def get_export_preset(preset_id: Optional[str]) -> Dict[str, Any]:
    """Returns the export preset configuration, defaulting to YouTube Shorts."""
    if not preset_id:
        return EXPORT_PRESETS[DEFAULT_EXPORT_PRESET]
    preset_key = str(preset_id).lower().replace(" ", "_").replace("-", "_")
    return EXPORT_PRESETS.get(preset_key, EXPORT_PRESETS[DEFAULT_EXPORT_PRESET])


def validate_export_preset(preset_id: str) -> bool:
    """Checks if the given preset ID is valid."""
    preset_key = str(preset_id).lower().replace(" ", "_").replace("-", "_")
    return preset_key in EXPORT_PRESETS

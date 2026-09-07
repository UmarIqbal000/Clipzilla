"""Platform publisher registry for social media uploads."""
from clipzilla.api.publishers.youtube import YouTubePublisher
from clipzilla.api.publishers.instagram import InstagramPublisher
from clipzilla.api.publishers.facebook import FacebookPublisher

PUBLISHER_REGISTRY = {
    "youtube": YouTubePublisher,
    "instagram": InstagramPublisher,
    "facebook": FacebookPublisher,
}

def get_publisher(platform: str):
    """Returns a publisher instance for the given platform."""
    cls = PUBLISHER_REGISTRY.get(platform)
    if not cls:
        raise ValueError(f"Unsupported platform: {platform}")
    return cls()

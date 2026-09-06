from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class SuggestedClip(BaseModel):
    start_time: float = Field(..., description="Start timestamp of the clip in seconds")
    end_time: float = Field(..., description="End timestamp of the clip in seconds")
    title: str = Field(..., min_length=3, description="Punchy, engaging title for the short")
    reason: str = Field(..., min_length=5, description="One-line explanation of why this segment works / strong hook")
    needs_trimming: Optional[bool] = Field(False, description="Whether clip starts or ends mid-sentence")
    trimming_notes: Optional[str] = Field(None, description="Heuristic suggestions or observations on boundaries")

    @field_validator("end_time")
    @classmethod
    def validate_end_after_start(cls, v: float, info):
        start = info.data.get("start_time")
        if start is not None and v <= start:
            raise ValueError(f"end_time ({v}s) must be greater than start_time ({start}s)")
        return v


class SuggestedClipsResponse(BaseModel):
    clips: List[SuggestedClip] = Field(
        ...,
        description="3 to 8 self-contained, high-retention short clips"
    )

    @field_validator("clips")
    @classmethod
    def validate_clips_list(cls, v: List[SuggestedClip]):
        if not v:
            raise ValueError("At least one clip must be suggested.")
        return v


def validate_clip_timestamps(clips: List[SuggestedClip], max_duration: float) -> List[str]:
    """
    Validates that all suggested clips fall strictly within the video's total duration.
    Returns a list of validation error descriptions (empty if all valid).
    """
    errors = []
    # Allow 1.0s grace window for rounding at the very end of video
    allowed_max = max_duration + 1.0

    for i, clip in enumerate(clips, 1):
        if clip.start_time < 0:
            errors.append(f"Clip #{i} ('{clip.title}'): start_time ({clip.start_time}s) cannot be negative.")
        if clip.end_time > allowed_max:
            errors.append(
                f"Clip #{i} ('{clip.title}'): end_time ({clip.end_time}s) exceeds total video duration ({max_duration:.2f}s)."
            )
        if clip.end_time <= clip.start_time:
            errors.append(f"Clip #{i} ('{clip.title}'): end_time must be strictly greater than start_time.")
        dur = clip.end_time - clip.start_time
        if dur < 5.0:
            errors.append(f"Clip #{i} ('{clip.title}'): duration ({dur:.1f}s) is too short for a short (minimum 5s).")

    return errors

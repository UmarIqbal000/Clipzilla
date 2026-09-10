import logging
import urllib.request
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
import cv2

from clipzilla.config import DEFAULT_MODELS_DIR, TARGET_WIDTH, TARGET_HEIGHT

logger = logging.getLogger("clipzilla.reframe")

BLAZE_FACE_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_detector/"
    "blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
)


def ensure_face_detector_model(models_dir: Path = DEFAULT_MODELS_DIR) -> Path:
    """Ensures the MediaPipe BlazeFace short-range TFLite model exists locally."""
    models_dir = Path(models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)
    model_path = models_dir / "blaze_face_short_range.tflite"

    if not model_path.exists() or model_path.stat().st_size == 0:
        logger.info(f"Downloading MediaPipe face detection model (~220 KB) to {model_path}...")
        try:
            urllib.request.urlretrieve(BLAZE_FACE_URL, model_path)
            logger.info("Face detector model downloaded successfully.")
        except Exception as e:
            logger.warning(f"Could not download MediaPipe face detector model: {e}")
            raise

    return model_path


def get_face_detector(model_path: Path):
    """Initializes MediaPipe FaceDetector."""
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import FaceDetector, FaceDetectorOptions

    options = FaceDetectorOptions(
        base_options=BaseOptions(model_asset_path=str(model_path)),
        min_detection_confidence=0.5,
    )
    return FaceDetector.create_from_options(options)


def sample_speaker_positions(
    video_path: Path,
    start: float,
    end: float,
    sample_interval: float = 0.5,
    models_dir: Path = DEFAULT_MODELS_DIR,
) -> List[Tuple[float, Optional[float], float]]:
    """
    Samples frames from video clip at a low rate (e.g. every 0.5s).
    Uses MediaPipe face detection to find the primary speaker's horizontal center position.
    Returns: List of (relative_timestamp, normalized_center_x, confidence).
    """
    import mediapipe as mp

    video_path = Path(video_path).resolve()
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video file: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_duration = total_frames / fps

    start = max(0.0, start)
    end = min(video_duration if video_duration > 0 else end, end)
    clip_duration = max(0.1, end - start)

    model_path = ensure_face_detector_model(models_dir)
    detector = get_face_detector(model_path)

    samples = []
    num_samples = max(1, int(clip_duration / sample_interval))
    timestamps = [start + i * sample_interval for i in range(num_samples)]
    if timestamps[-1] < end - 0.2:
        timestamps.append(end - 0.1)

    logger.info(f"Sampling speaker face position across {len(timestamps)} frames (every {sample_interval}s)...")

    for idx, t in enumerate(timestamps):
        rel_t = t - start
        frame_idx = int(t * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret or frame is None:
            samples.append((rel_t, None, 0.0))
            continue

        h, w = frame.shape[:2]
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        try:
            result = detector.detect(mp_image)
            if result.detections:
                # Select primary speaker (largest bounding box)
                best_det = None
                best_area = 0.0
                best_conf = 0.0
                for det in result.detections:
                    box = det.bounding_box
                    area = (box.width * box.height) / (w * h)
                    score = det.categories[0].score if det.categories else 0.5
                    if area > best_area and score >= 0.45:
                        best_area = area
                        best_det = det
                        best_conf = score

                if best_det:
                    box = best_det.bounding_box
                    cx = (box.origin_x + box.width / 2.0) / w
                    cx = max(0.0, min(1.0, cx))
                    samples.append((rel_t, cx, best_conf))
                else:
                    samples.append((rel_t, None, 0.0))
            else:
                samples.append((rel_t, None, 0.0))
        except Exception as e:
            logger.debug(f"Detection failed on frame at {t:.2f}s: {e}")
            samples.append((rel_t, None, 0.0))

    cap.release()
    return samples


def smooth_speaker_positions(
    samples: List[Tuple[float, Optional[float], float]],
    alpha: float = 0.25,
    deadband: float = 0.035,
) -> List[Tuple[float, float]]:
    """
    Smooths detected positions over time using linear interpolation for missing detections
    and Exponential Moving Average (EMA) with deadband dampening to avoid jittery camera panning.
    """
    if not samples:
        return []

    # 1. Fill missing samples by forward/backward fill or linear interpolation
    filled_xs = []
    known_indices = [i for i, s in enumerate(samples) if s[1] is not None]

    if not known_indices:
        # All frames missing, default to center (0.5)
        return [(s[0], 0.5) for s in samples]

    for i, s in enumerate(samples):
        if s[1] is not None:
            filled_xs.append(s[1])
        else:
            # Interpolate from nearest known
            prev_known = [k for k in known_indices if k < i]
            next_known = [k for k in known_indices if k > i]
            if prev_known and next_known:
                p_idx = prev_known[-1]
                n_idx = next_known[0]
                p_val = samples[p_idx][1]
                n_val = samples[n_idx][1]
                assert p_val is not None and n_val is not None
                weight = (i - p_idx) / (n_idx - p_idx)
                interp = (1 - weight) * p_val + weight * n_val
                filled_xs.append(interp)
            elif prev_known:
                p_val = samples[prev_known[-1]][1]
                assert p_val is not None
                filled_xs.append(p_val)
            else:
                n_val = samples[next_known[0]][1]
                assert n_val is not None
                filled_xs.append(n_val)

    # 2. Smooth with Exponential Moving Average + deadband
    smoothed = []
    current_x = filled_xs[0]

    for (t, _, _), target_x in zip(samples, filled_xs):
        diff = target_x - current_x
        if abs(diff) > deadband:
            # Move towards target smoothly
            current_x = current_x + alpha * diff
        smoothed.append((t, float(np.clip(current_x, 0.0, 1.0))))

    return smoothed


def get_speaker_crop_path(
    video_path: Path,
    start: float,
    end: float,
    sample_interval: float = 0.5,
    models_dir: Path = DEFAULT_MODELS_DIR,
) -> List[Dict[str, Any]]:
    """
    Returns timestamped horizontal center points and confidence for timeline visualization.
    """
    try:
        samples = sample_speaker_positions(
            video_path=video_path,
            start=start,
            end=end,
            sample_interval=sample_interval,
            models_dir=models_dir,
        )
        smoothed = smooth_speaker_positions(samples)
        smoothed_map = {round(s[0], 2): s[1] for s in smoothed}

        results = []
        for rel_t, raw_cx, conf in samples:
            t_key = round(rel_t, 2)
            smooth_cx = smoothed_map.get(t_key, raw_cx if raw_cx is not None else 0.5)
            results.append({
                "time": round(rel_t, 2),
                "center_x": round(smooth_cx, 3),
                "raw_center_x": round(raw_cx, 3) if raw_cx is not None else None,
                "confidence": round(conf, 2),
            })
        return results
    except Exception as e:
        logger.warning(f"Could not compute speaker crop path: {e}")
        num_points = max(2, int((end - start) / sample_interval))
        return [
            {"time": round(i * sample_interval, 2), "center_x": 0.5, "raw_center_x": 0.5, "confidence": 0.0}
            for i in range(num_points)
        ]


def build_reframe_filter(
    video_path: Path,
    start: float,
    end: float,
    mode: str = "auto",
    target_w: int = TARGET_WIDTH,
    target_h: int = TARGET_HEIGHT,
    crop_override: Optional[Dict[str, Any]] = None,
    models_dir: Path = DEFAULT_MODELS_DIR,
) -> Tuple[str, Dict[str, Any]]:
    """
    Builds an FFmpeg video filter for vertical short reframing.

    Modes:
      - 'auto': Detects primary speaker; if face confidence < 30%, falls back to blurred background fill.
      - 'face': Forces speaker face tracking.
      - 'blur': Forces blurred background fill with centered source video.
      - 'center': Static center crop.

    Returns:
      (filtergraph_string, metadata_dict)
    """
    video_path = Path(video_path).resolve()
    cap = cv2.VideoCapture(str(video_path))
    w_src = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h_src = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    if w_src <= 0 or h_src <= 0:
        w_src, h_src = 1920, 1080

    target_aspect = target_w / target_h  # 9/16 = 0.5625
    src_aspect = w_src / h_src

    info: Dict[str, Any] = {
        "mode": mode,
        "src_width": w_src,
        "src_height": h_src,
        "has_speaker": False,
        "strategy": "center_crop",
    }

    # If source is already vertical (e.g. 9:16), just scale
    if abs(src_aspect - target_aspect) < 0.05:
        filter_str = f"scale={target_w}:{target_h}"
        info["strategy"] = "direct_scale"
        return filter_str, info

    # Check for explicit crop override from user
    if crop_override:
        override_mode = crop_override.get("mode", "auto")
        if override_mode == "blur":
            filter_str = (
                f"[0:v]split=2[bg][fg];"
                f"[bg]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,crop={target_w}:{target_h},boxblur=20:5[blurred];"
                f"[fg]scale={target_w}:-2[scaled];"
                f"[blurred][scaled]overlay=(W-w)/2:(H-h)/2[v]"
            )
            info["strategy"] = "blurred_fill_override"
            return filter_str, info
        elif override_mode in ("center", "left", "right", "manual"):
            crop_w = int(h_src * target_aspect)
            crop_h = h_src
            max_x = max(0, w_src - crop_w)
            if override_mode == "center":
                cx = 0.5
            elif override_mode == "left":
                cx = 0.25
            elif override_mode == "right":
                cx = 0.75
            else:
                cx = float(crop_override.get("center_x", 0.5))
            crop_x = int(cx * w_src - crop_w / 2)
            crop_x = max(0, min(max_x, crop_x))
            filter_str = f"crop={crop_w}:{crop_h}:{crop_x}:0,scale={target_w}:{target_h}"
            info["strategy"] = f"{override_mode}_override"
            info["crop_x"] = crop_x
            return filter_str, info

    if mode == "blur":
        # Force blurred background fill
        filter_str = (
            f"[0:v]split=2[bg][fg];"
            f"[bg]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,crop={target_w}:{target_h},boxblur=20:5[blurred];"
            f"[fg]scale={target_w}:-2[scaled];"
            f"[blurred][scaled]overlay=(W-w)/2:(H-h)/2[v]"
        )
        info["strategy"] = "blurred_fill"
        return filter_str, info

    if mode == "center":
        # Static center crop
        crop_w = int(h_src * target_aspect)
        crop_h = h_src
        crop_x = (w_src - crop_w) // 2
        filter_str = f"crop={crop_w}:{crop_h}:{crop_x}:0,scale={target_w}:{target_h}"
        info["strategy"] = "static_center"
        return filter_str, info

    # mode == "auto" or "face"
    try:
        samples = sample_speaker_positions(video_path, start, end, sample_interval=0.5, models_dir=models_dir)
        valid_samples = [s for s in samples if s[1] is not None]
        detection_ratio = len(valid_samples) / max(1, len(samples))
        logger.info(f"Speaker face detected in {detection_ratio * 100:.1f}% of sampled frames ({len(valid_samples)}/{len(samples)}).")

        if detection_ratio >= 0.25 or (mode == "face" and len(valid_samples) > 0):
            info["has_speaker"] = True
            smoothed = smooth_speaker_positions(samples)
            smoothed_xs = [s[1] for s in smoothed]

            # Calculate crop dimensions maintaining 9:16
            crop_h = h_src
            crop_w = int(h_src * target_aspect)
            max_x = w_src - crop_w

            # Check if subject moves significantly
            spread = max(smoothed_xs) - min(smoothed_xs)
            info["movement_spread"] = round(spread, 3)

            if spread > 0.12 and len(smoothed) > 2:
                # Dynamic panning crop expression across time t
                # Build linear piecewise interpolation: lerp between keyframe timestamps
                # clamp((center_x - crop_w/2), 0, max_x)
                conditions = []
                for i in range(len(smoothed) - 1):
                    t1, x1 = smoothed[i]
                    t2, x2 = smoothed[i + 1]
                    px1 = max(0, min(max_x, int(x1 * w_src - crop_w / 2)))
                    px2 = max(0, min(max_x, int(x2 * w_src - crop_w / 2)))
                    dt = max(0.01, t2 - t1)
                    # Expression: px1 + (t - t1) * ((px2 - px1) / dt)
                    expr = f"({px1}+({px2}-{px1})*(t-{t1:.2f})/{dt:.2f})"
                    conditions.append(f"if(lt(t,{t2:.2f}),{expr},")

                last_px = max(0, min(max_x, int(smoothed[-1][1] * w_src - crop_w / 2)))
                dynamic_x = "".join(conditions) + str(last_px) + (")" * len(conditions))
                filter_str = f"crop={crop_w}:{crop_h}:'{dynamic_x}':0,scale={target_w}:{target_h}"
                info["strategy"] = "dynamic_face_tracking"
            else:
                # Smooth stable framing around speaker's average position
                avg_cx = float(np.mean(smoothed_xs))
                crop_x = int(avg_cx * w_src - crop_w / 2)
                crop_x = max(0, min(max_x, crop_x))
                filter_str = f"crop={crop_w}:{crop_h}:{crop_x}:0,scale={target_w}:{target_h}"
                info["strategy"] = "stable_face_framing"
                info["crop_x"] = crop_x

            return filter_str, info

    except Exception as e:
        logger.warning(f"Face tracking error: {e}. Falling back to blurred background fill.")

    # Fallback when no face is confidently detected
    logger.info("No primary speaker face detected confidently. Using blurred background fill fallback.")
    filter_str = (
        f"[0:v]split=2[bg][fg];"
        f"[bg]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,crop={target_w}:{target_h},boxblur=20:5[blurred];"
        f"[fg]scale={target_w}:-2[scaled];"
        f"[blurred][scaled]overlay=(W-w)/2:(H-h)/2[v]"
    )
    info["strategy"] = "blurred_fill_fallback"
    return filter_str, info

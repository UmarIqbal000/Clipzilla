# Clipzilla

> **Monster that devours long-form and spits out shorts.**

Clipzilla is an open-source, local-first CLI tool that converts long YouTube videos into vertical shorts (1080x1920) with burned-in, word-highlighted animated subtitles.

Designed for efficiency and simplicity, Clipzilla runs comfortably on modest hardware (**8 GB RAM, no GPU required**) by streaming media directly through FFmpeg subprocesses and running `faster-whisper` with `int8` quantization.

---

## Features

- **Local-First & Lightweight**: No web UI, no heavyweight video editing frameworks (no MoviePy). Everything is processed locally.
- **Smart Downloads (`clipzilla download`)**: Downloads YouTube videos capped at 1080p using `yt-dlp`, fetching audio and auto-generated/manual captions into organized `./workdir/<video_id>/` workspaces.
- **Unified Word-Level Transcripts (`clipzilla transcribe`)**:
  - Automatically converts existing YouTube captions into a unified word-level JSON transcript without extra compute.
  - Falls back to `faster-whisper` (CTranslate2 backend, `int8` quantization on CPU by default, auto-detects GPU if available).
  - Use `--force-whisper` to run Whisper even when captions exist.
- **Shorts Generator (`clipzilla clip`)**:
  - Center-crops video into vertical 9:16 format (1080x1920).
  - Generates Advanced SubStation Alpha (`.ass`) subtitle files with active word-by-word karaoke highlighting.
  - Streams video encoding and subtitle burning via FFmpeg subprocesses without loading video files into memory.

---

## Requirements

1. **Python 3.11+**
2. **FFmpeg** installed and accessible in your system `PATH` (compiled with `--enable-libass`).
   - Check with: `ffmpeg -version`

---

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-username/clipzilla.git
cd clipzilla
```

### 2. Create and activate a Python 3.11 virtual environment
```bash
# Windows
uv venv --python 3.11 .venv
.\.venv\Scripts\activate

# Linux / macOS
python3.11 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -e .
```
*(Or install using `requirements.txt`: `pip install -r requirements.txt && pip install -e .`)*

---

## Usage

### 1. Download a YouTube Video
Downloads the video (capped at 1080p) and any available subtitles to `./workdir/<video_id>/`:
```bash
clipzilla download "https://www.youtube.com/watch?v=x7X9w_GIm1s"
```

### 2. Transcribe Video
Converts downloaded captions or runs `faster-whisper` to produce word-level timestamps in `transcript.json`:
```bash
# Auto-selects video if only one exists in workdir
clipzilla transcribe

# Or specify video ID
clipzilla transcribe x7X9w_GIm1s

# Force faster-whisper transcription (bypassing YouTube captions)
clipzilla transcribe x7X9w_GIm1s --force-whisper --model base
```

### 3. Cut a Vertical Short
Cuts a segment from `--start` to `--end` (in seconds or `HH:MM:SS`), center-crops to 1080x1920, and burns in word-highlighted subtitles:
```bash
# Cut from 5s to 25s
clipzilla clip --start 5 --end 25

# Cut with custom output path
clipzilla clip x7X9w_GIm1s --start 00:00:10 --end 00:00:40 --output shorts/python_short.mp4

# Cut without subtitles
clipzilla clip --start 10 --end 30 --no-subtitles
```

---

## Workspace Layout (`workdir/`)

Intermediate files and outputs are grouped cleanly per video:
```
workdir/
└── <video_id>/
    ├── source.mp4                      # Downloaded 1080p source video
    ├── source.en.vtt                   # YouTube captions (if present)
    ├── metadata.json                   # Video metadata
    ├── transcript.json                 # Standardized word-level transcript
    ├── subtitles_10_00_40_00.ass       # Generated ASS subtitles with word highlighting
    └── clip_10_00_40_00.mp4            # Final 1080x1920 vertical short
```

---

## Running Tests

### Unit Tests
```bash
python -m unittest discover tests
```

### End-to-End Integration Test
Runs the full pipeline on a real ~2 minute YouTube video (*Python in 100 Seconds*) to verify download, transcription, ASS subtitle generation, and 1080x1920 FFmpeg rendering:
```bash
python tests/test_pipeline.py
```

---

## License

MIT License. See `LICENSE` for details.

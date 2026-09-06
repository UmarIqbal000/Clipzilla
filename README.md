# Clipzilla

> **Monster that devours long-form and spits out shorts.**

Clipzilla is an open-source, local-first CLI tool that converts long YouTube videos into vertical shorts (1080x1920) with burned-in, word-highlighted animated subtitles.

Designed for efficiency and simplicity, Clipzilla runs comfortably on modest hardware (**8 GB RAM, no GPU required**) by streaming media directly through FFmpeg subprocesses, running `faster-whisper` with `int8` quantization, and using interchangeable LLM providers (Ollama local, Ollama Cloud, OpenAI-compatible APIs) to intelligently pinpoint viral clip moments.

---

## Features

- **Local-First & Lightweight**: No web UI, no heavyweight video editing frameworks (no MoviePy). Everything is processed locally.
- **Smart Downloads (`clipzilla download`)**: Downloads YouTube videos capped at 1080p using `yt-dlp`, fetching audio and auto-generated/manual captions into organized `./workdir/<video_id>/` workspaces.
- **Unified Word-Level Transcripts (`clipzilla transcribe`)**:
  - Automatically converts existing YouTube captions into a unified word-level JSON transcript without extra compute.
  - Falls back to `faster-whisper` (CTranslate2 backend, `int8` quantization on CPU by default, auto-detects GPU if available).
  - Use `--force-whisper` to run Whisper even when captions exist.
- **Intelligent Clip Analysis (`clipzilla analyze`)**:
  - Leverages interchangeable LLM providers to detect 3–8 self-contained, high-retention moments with strong hooks.
  - Strict Pydantic JSON schema validation with an automatic 2-attempt error correction feedback loop.
  - Independent heuristic scoring to flag clips that start or end mid-sentence and suggest clean boundary trims.
- **Shorts Generator (`clipzilla clip`)**:
  - Center-crops video into vertical 9:16 format (1080x1920).
  - Generates Advanced SubStation Alpha (`.ass`) subtitle files with active word-by-word karaoke highlighting.
  - Streams video encoding and subtitle burning via FFmpeg subprocesses without loading video files into memory.

---

## Requirements

1. **Python 3.11+**
2. **FFmpeg** installed and accessible in your system `PATH` (compiled with `--enable-libass`).
   - Check with: `ffmpeg -version`
3. *(Optional for AI clip analysis)* **Ollama** or an OpenAI-compatible endpoint (Groq, OpenRouter, LM Studio).

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

## LLM Provider Setup & Configuration

Clipzilla supports three LLM provider backends through OpenAI-compatible `/v1/chat/completions` endpoints. Copy `config.yaml.example` to `config.yaml` to configure your preferred backend:

```bash
cp config.yaml.example config.yaml
```

### Option A: Ollama Local (Free, 100% Private, Default)
1. Download and install Ollama from [ollama.com](https://ollama.com).
2. Pull and run your preferred model:
   ```bash
   ollama run llama3.2
   ```
3. In `config.yaml`:
   ```yaml
   provider: ollama_local
   providers:
     ollama_local:
       base_url: "http://localhost:11434/v1"
       model: "llama3.2"
   ```

### Option B: Ollama Cloud
1. Sign in to [ollama.com](https://ollama.com) and generate an API key.
2. Set the `OLLAMA_API_KEY` environment variable:
   ```bash
   # Windows (PowerShell)
   $env:OLLAMA_API_KEY = "your_api_key_here"

   # Linux / macOS
   export OLLAMA_API_KEY="your_api_key_here"
   ```
3. In `config.yaml`:
   ```yaml
   provider: ollama_cloud
   providers:
     ollama_cloud:
       base_url: "https://ollama.com/v1"
       api_key_env: "OLLAMA_API_KEY"
       model: "llama3.2"
   ```

### Option C: Custom OpenAI-Compatible Endpoints (Groq, OpenRouter, LM Studio)
Clipzilla works with any provider offering standard `/v1/chat/completions`:

- **Groq (Fast Cloud Inference)**:
  ```bash
  export GROQ_API_KEY="gsk_..."
  ```
  ```yaml
  provider: openai_compat
  providers:
    openai_compat:
      base_url: "https://api.groq.com/openai/v1"
      api_key_env: "GROQ_API_KEY"
      model: "llama-3.3-70b-versatile"
  ```
- **LM Studio (Local GUI)**:
  ```yaml
  provider: openai_compat
  providers:
    openai_compat:
      base_url: "http://localhost:1234/v1"
      model: "local-model"
  ```

---

## Usage Workflow

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

### 3. Analyze for High-Retention Clips
Prompts the LLM to identify 3–8 viral segments with strong opening hooks, checks for mid-sentence trimming issues, and saves suggestions to `clips_suggested.json`:
```bash
# Uses active provider in config.yaml
clipzilla analyze

# Or override provider / model from the command line:
clipzilla analyze x7X9w_GIm1s --provider openai_compat --model llama-3.3-70b-versatile
```

### 4. Cut a Vertical Short
Cuts a segment from `--start` to `--end` (in seconds or `HH:MM:SS`), center-crops to 1080x1920, and burns in word-highlighted subtitles:
```bash
# Cut based on suggested timestamps
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
    ├── clips_suggested.json            # Suggested clips with titles, hooks, and trimming notes
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
Runs the full download, transcribe, and clipping pipeline on a real ~2 minute YouTube video (*Python in 100 Seconds*):
```bash
python tests/test_pipeline.py
```

---

## License

MIT License. See `LICENSE` for details.

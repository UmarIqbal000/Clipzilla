# Clipzilla

> **Monster that devours long-form and spits out shorts.**

Clipzilla is an open-source, local-first CLI tool that converts long YouTube videos into vertical shorts (1080x1920) with AI speaker reframing and animated, word-highlighted subtitles.

Designed for efficiency and simplicity, Clipzilla runs comfortably on modest hardware (**8 GB RAM, no GPU required**) by streaming media directly through FFmpeg subprocesses, running `faster-whisper` with `int8` quantization, tracking speaker faces with lightweight MediaPipe, and using interchangeable LLM providers (Ollama local, Ollama Cloud, OpenAI-compatible APIs) to automatically create ready-to-post vertical shorts.

---

## Features

- **Local-First & Lightweight**: No web UI, no heavyweight video editing frameworks (no MoviePy). Everything streams locally via FFmpeg.
- **Smart Downloads (`clipzilla download`)**: Downloads YouTube videos capped at 1080p using `yt-dlp`, fetching audio and auto-generated/manual captions into organized `./workdir/<video_id>/` workspaces.
- **Unified Word-Level Transcripts (`clipzilla transcribe`)**:
  - Automatically converts existing YouTube captions into a unified word-level JSON transcript without extra compute.
  - Falls back to `faster-whisper` (CTranslate2 backend, `int8` quantization on CPU by default, auto-detects GPU if available).
  - Use `--force-whisper` to run Whisper even when captions exist.
- **Intelligent Clip Analysis (`clipzilla analyze`)**:
  - Leverages interchangeable LLM providers to detect 3–8 self-contained, high-retention moments with strong hooks.
  - Strict Pydantic JSON schema validation with an automatic 2-attempt error correction feedback loop.
  - Independent heuristic scoring to flag clips that start or end mid-sentence and suggest clean boundary trims.
- **Smart Face-Tracking Reframe (`reframe.py`)**:
  - Samples video frames every 0.5s and tracks primary speaker face position using MediaPipe.
  - Exponential moving average (EMA) smoothing with deadband dampening eliminates jittery camera movement.
  - Generates 1080x1920 vertical crops keeping the speaker centered.
  - **Aesthetic Fallback**: If no face is confidently detected (e.g. gameplay, tutorials, slides), automatically applies a static center crop overlaid onto a blurred, scaled background fill.
- **Animated Caption Presets (`subtitles.py`)**:
  - **Preset `karaoke`**: 3–5 word lines with progressive, active word illumination.
  - **Preset `single`**: Punchy, bold single-word pop-up with subtle scale zoom animation (`\fscx115\fscy115 -> \fscx100\fscy100`).
  - Configurable font, highlight color (`yellow`, `cyan`, `green`, `white`, or hex `#RRGGBB`), and screen position (`bottom`, `middle`, `top`).
- **One-Click Auto Pipeline (`clipzilla auto`)**:
  - Chains download → transcribe → analyze → reframe → caption → export with a single command.
  - Writes all finished shorts to `./workdir/<video_id>/clips/`.
  - **Atomic & Resumable**: Uses temporary files (`.tmp.mp4`) to avoid corrupt files on interruption. Resuming skips already processed stages and existing clips.

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
```yaml
provider: openai_compat
providers:
  openai_compat:
    base_url: "https://api.groq.com/openai/v1"
    api_key_env: "GROQ_API_KEY"
    model: "llama-3.3-70b-versatile"
```

---

## Usage Workflow

### 🚀 The One-Click Way (`clipzilla auto`)
Run the entire end-to-end pipeline with a single command:
```bash
clipzilla auto "https://www.youtube.com/watch?v=x7X9w_GIm1s"
```
Customize reframing and subtitle animation:
```bash
clipzilla auto "https://www.youtube.com/watch?v=x7X9w_GIm1s" \
  --preset single \
  --color cyan \
  --reframe auto
```
Outputs are exported directly to `./workdir/<video_id>/clips/`. If interrupted, simply rerun the command — finished stages and clips are safely resumed!

---

### 🛠️ Step-by-Step CLI Commands

#### 1. Download Video
Downloads the video capped at 1080p and all available subtitles to `./workdir/<video_id>/`:
```bash
clipzilla download "https://www.youtube.com/watch?v=x7X9w_GIm1s"
```

#### 2. Transcribe
Converts downloaded captions or runs `faster-whisper` (`int8` quantization) to produce word-level timestamps in `transcript.json`:
```bash
clipzilla transcribe
```

#### 3. Analyze for High-Retention Clips
Prompts the LLM to identify 3–8 viral moments, runs heuristic boundary trimming checks, and saves suggestions to `clips_suggested.json`:
```bash
clipzilla analyze
```

#### 4. Cut a Custom Short
Cuts a segment, applies MediaPipe speaker reframing (or blurred fill), and burns in animated captions:
```bash
# Line-level karaoke highlight (default)
clipzilla clip --start 5 --end 25

# Single-word pop-up preset with cyan highlight
clipzilla clip --start 10 --end 30 --preset single --color cyan

# Force blurred background fill (ideal for gameplay or code tutorials)
clipzilla clip --start 10 --end 30 --reframe blur

# Custom output file
clipzilla clip x7X9w_GIm1s --start 00:00:10 --end 00:00:40 --output shorts/python_short.mp4
```

---

## Workspace Layout (`workdir/`)

```
workdir/
└── <video_id>/
    ├── source.mp4                      # Downloaded 1080p source video
    ├── source.en.vtt                   # YouTube captions (if present)
    ├── metadata.json                   # Video metadata
    ├── transcript.json                 # Standardized word-level transcript
    ├── clips_suggested.json            # AI suggested clips with titles and hooks
    ├── subtitles_5_00_25_00.ass        # Generated animated ASS subtitles
    └── clips/                          # One-click exported shorts
        ├── clip_01_Python_Basics.mp4
        ├── clip_02_Why_Zen_Code.mp4
        └── ...
```

---

## Running Tests

```bash
# Run all unit tests
python -m unittest tests/test_reframe.py tests/test_captions.py tests/test_cli.py tests/test_llm_providers.py tests/test_heuristics.py tests/test_analyzer.py tests/test_config.py
```

---

## License

MIT License. See `LICENSE` for details.

<p align="center">
  <img src="assets/clipzilla-logo.png" alt="Clipzilla Logo" width="200" />
</p>

<h1 align="center">Clipzilla</h1>

<p align="center">
  <strong>🦖 Monster that devours long-form and spits out shorts.</strong>
</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  <img alt="FFmpeg" src="https://img.shields.io/badge/FFmpeg-required-007808?logo=ffmpeg&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" />
</p>

<p align="center">
  <a href="#-about-the-application">About</a> •
  <a href="#-core-features">Features</a> •
  <a href="#-about-web-ui">Web UI</a> •
  <a href="#-about-cli">CLI</a> •
  <a href="#-llm-provider-configurations">LLM Configs</a> •
  <a href="#-prerequisites">Prerequisites</a> •
  <a href="#-how-to-start-the-application">Getting Started</a> •
  <a href="#-deploying-s3--aws-lambda-automation-for-auto-publication">Deploy</a> •
  <a href="#-configuring-meta-instagram--facebook--youtube">Social Accounts</a> •
  <a href="#-all-cli-commands">CLI Reference</a> •
  <a href="#%EF%B8%8F-configurations">Configurations</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-testing">Testing</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-troubleshooting">Troubleshooting</a> •
  <a href="#-contributing">Contributing</a> •
  <a href="#-license">License</a>
</p>

---

Clipzilla is an open-source, local-first tool that converts long YouTube videos into viral vertical shorts (1080×1920) with **AI-powered speaker face tracking** and **animated word-highlighted subtitles**. It ships with both a sleek retro-themed **Web UI** and a powerful **CLI**, and can auto-publish finished shorts to **YouTube**, **Instagram**, and **Facebook** in one click.

Designed for efficiency and simplicity, Clipzilla runs comfortably on modest hardware (**8 GB RAM, no GPU required**) by streaming media directly through FFmpeg subprocesses, running `faster-whisper` with `int8` quantization, tracking speaker faces with lightweight MediaPipe, and using interchangeable LLM providers (Ollama Local, Ollama Cloud, or any OpenAI-compatible API) to automatically discover high-retention moments and produce ready-to-post vertical shorts.

---

## 📸 Homepage

<p align="center">
  <img src="assets/homepage.png" alt="Clipzilla Homepage" width="100%" />
</p>

<p align="center"><em>Clipzilla's retro celluloid-themed Web UI — paste a YouTube link, pick your platform, and let the monster devour.</em></p>

<p align="center">
  <img src="assets/hero.png" alt="Clipzilla Hero Section" width="100%" />
</p>

<p align="center"><em>Above-the-fold hero with intake dispatch slip, export presets for YouTube Shorts / TikTok / Instagram Reels, and AI retention engine selector.</em></p>

---

## 📖 About the Application

Clipzilla was born from a simple observation: **creators spend hours manually scrubbing through long-form YouTube videos to find short-worthy moments**. Clipzilla automates this entire workflow — from downloading the source video to publishing finished vertical shorts — using a 6-stage AI pipeline:

1. **Download** — Fetches any YouTube video at up to 1080p with all available subtitles
2. **Transcribe** — Converts existing captions (or runs Whisper on the audio) into word-level timestamps
3. **Analyze** — Sends the transcript to an LLM that identifies 3–8 high-retention, hook-driven moments
4. **Reframe** — Tracks the speaker's face with MediaPipe and generates a smooth 9:16 vertical crop path
5. **Caption** — Generates animated `.ass` subtitles (karaoke highlight or single-word pop-up)
6. **Export** — Burns subtitles, applies crop/blur, encodes with `libx264`+`aac`, and writes atomically

The whole pipeline is **resumable** — if interrupted, simply rerun and finished stages/clips are skipped. Source videos are automatically cleaned up after clipping to conserve disk space (configurable).

---

## 🚀 Core Features

### 🎬 Pipeline Engine
| Feature | Description |
|---|---|
| **Smart Downloads** | Downloads YouTube videos capped at 1080p using `yt-dlp`, fetching audio and auto-generated/manual captions into organized `./workdir/<video_id>/` workspaces. |
| **Unified Word-Level Transcripts** | Converts existing YouTube captions into word-level JSON transcripts without extra compute. Falls back to `faster-whisper` (CTranslate2, `int8` on CPU, auto-detects GPU). Use `--force-whisper` to always run Whisper. |
| **AI Clip Analysis** | Leverages interchangeable LLM providers to detect 3–8 self-contained, high-retention moments with strong hooks. Strict Pydantic JSON schema validation with automatic 2-attempt error correction. Independent heuristic scoring flags clips that start or end mid-sentence. |
| **Smart Face-Tracking Reframe** | Samples video frames every 0.5s and tracks the primary speaker face with MediaPipe. EMA smoothing with deadband dampening eliminates jitter. Generates 1080×1920 vertical crops. Falls back to blurred background fill for gameplay/tutorials/slides. |
| **Animated Caption Presets** | **Karaoke**: 3–5 word lines with progressive word illumination. **Single-word**: Bold pop-up with scale zoom animation. Configurable font, highlight color, and screen position. |
| **One-Click Auto Pipeline** | Chains all 6 stages with a single command. Atomic & resumable with `.tmp.mp4` writes. |

### 🔧 Platform Export Presets

| Platform | Aspect Ratio | Max Duration | Video Bitrate | Audio Bitrate |
|---|---|---|---|---|
| YouTube Shorts | 9:16 | 3 min | 10 Mbps | 192 kbps |
| TikTok | 9:16 | 10 min | 12 Mbps | 192 kbps |
| Instagram Reels | 9:16 | 3 min | 8 Mbps | 192 kbps |

### 📤 One-Click Social Publishing
- Publish generated shorts directly to **YouTube**, **Instagram Reels**, and **Facebook Pages** from the Web UI.
- OAuth 2.0 integration for YouTube via Google API, and Meta Graph API for Instagram/Facebook.
- AWS S3 temporary hosting for Instagram and Facebook (they require a public URL for video ingestion).
- Supports **scheduled publishing** and **multi-platform** publishing in a single action.

---

## 🌐 About Web UI

Clipzilla's frontend is a **React 18 + Vite 5 + Tailwind CSS 3** single-page application with a unique **retro celluloid / creature-feature poster** design language.

### Screens

| Screen | Path | Description |
|---|---|---|
| **Create** | `/` or `/home` | Intake dispatch — submit YouTube URLs and configure pipeline options |
| **Shorts Vault** | `/shorts` | Master library of all generated vertical shorts across all jobs |
| **History** | `/history` | Archive of all processing jobs with status, filtering, and search |
| **Batch Detail** | `/batch/:id` | Detailed view of shorts generated from a specific video |
| **Timeline Editor** | `/editor` | Professional clip editor with trim, caption, crop, and style controls |
| **Settings** | `/settings` | AI provider engine management and profile configuration |
| **Accounts** | `/accounts` | Social media account management, OAuth connections, platform credentials, and S3 configuration |

### Key Capabilities

- **480p Proxy Ingest** — Automatically encodes a lightweight 480p proxy for zero-lag in-browser scrubbing.
- **Interactive Timeline Editor** — Draggable trim handles, inline caption text editing, crop-focus track with overrides (Auto AI, Center, Left, Right, Blurred Fill, Manual Drag).
- **Draggable 9:16 Crop Box** — Directly reposition the crop rectangle over the 16:9 canvas.
- **Typography Studio** — 9 viral font families, 4 size presets, 7 highlight colors, text transforms, and animation style selectors.
- **Selective Re-rendering** — Re-crops, re-captions, and re-exports only modified shorts from the 1080p source without re-running transcription or analysis.
- **Batch Processing** — Submit multiple YouTube URLs at once and monitor progress.
- **History & Vault** — Browse all previously generated shorts with filtering, search, and inline editing.
- **Social Publishing Modal** — Select accounts, add title/description/tags, set privacy, and publish to multiple platforms simultaneously.

### Design System

| Element | Details |
|---|---|
| **Palette** | Warm cream paper (`#F1EAD8`), deep ink black (`#18140F`), rust CTA (`#C1502E`), creature moss (`#2F4B3C`) |
| **Typography** | Anton & Bebas Neue (headlines), Newsreader Italic (accents), Plus Jakarta Sans (body) |
| **Interactions** | Hard offset retro shadows, camera shutter snap animations, celluloid reel spinners, film sprocket borders |

---

## 🖥️ About CLI

Clipzilla ships a **Click-based CLI** registered as the `clipzilla` command (installed via `pip install -e .`). The CLI provides both a **one-click auto pipeline** and **granular step-by-step commands** for power users.

The CLI is useful for:
- **Headless automation** — Run on a server or in CI/CD without a browser.
- **Batch scripting** — Wrap Clipzilla commands in shell scripts for large-scale processing.
- **Docker one-offs** — Execute single pipeline runs inside Docker containers.
- **Fine-grained control** — Run individual stages (download, transcribe, analyze, clip) independently.

See the [All CLI Commands](#-all-cli-commands) section below for the full reference.

---

## 🤖 LLM Provider Configurations

Clipzilla's AI clip analysis engine supports **three interchangeable LLM provider types**. You can switch between them at any time — via `config.yaml`, CLI flags, or the Web UI Settings page.

### Option A: Ollama Local (Free, 100% Private — Default)

Runs entirely on your machine. No API key needed.

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

Cloud-hosted Ollama with an API key.

1. Sign in at [ollama.com](https://ollama.com) and generate an API key.
2. Set the environment variable:
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

### Option C: OpenAI-Compatible Endpoints (Groq, OpenRouter, LM Studio, DeepSeek, vLLM)

Works with **any** endpoint implementing `/v1/chat/completions`.

```yaml
provider: openai_compat
providers:
  openai_compat:
    base_url: "https://api.groq.com/openai/v1"
    api_key_env: "GROQ_API_KEY"
    model: "llama-3.3-70b-versatile"
```

<details>
<summary>OpenRouter example</summary>

```yaml
provider: openai_compat
providers:
  openai_compat:
    base_url: "https://openrouter.ai/api/v1"
    api_key_env: "OPENROUTER_API_KEY"
    model: "meta-llama/llama-3.2-3b-instruct"
```
</details>

<details>
<summary>LM Studio (Local) example</summary>

```yaml
provider: openai_compat
providers:
  openai_compat:
    base_url: "http://localhost:1234/v1"
    model: "local-model"
```
</details>

<details>
<summary>DeepSeek example</summary>

```yaml
provider: openai_compat
providers:
  openai_compat:
    base_url: "https://api.deepseek.com/v1"
    api_key_env: "DEEPSEEK_API_KEY"
    model: "deepseek-chat"
```
</details>

---

## 📋 Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Python** | 3.11+ | Required |
| **Node.js** | 18+ | For the Web UI |
| **FFmpeg** | Any recent | Must be in your system `PATH`, compiled with `--enable-libass` |
| **LLM Provider** | *(Optional)* | Ollama, Groq, OpenRouter, etc. for AI clip analysis |
| **AWS Account** | *(Optional)* | Only if publishing to Instagram/Facebook (requires S3 for temporary video hosting) |
| **Google Cloud Console** | *(Optional)* | Only if publishing to YouTube (requires OAuth2 client credentials) |
| **Meta Developer Account** | *(Optional)* | Only if publishing to Instagram/Facebook |

### Verify FFmpeg

```bash
ffmpeg -version
```

If not installed:
- **Windows**: `choco install ffmpeg` or download from [ffmpeg.org](https://ffmpeg.org/download.html)
- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt install ffmpeg`

---

## 🏁 How to Start the Application

### Method 1: Standard Application (Full-Stack Dev Mode)

#### 1. Clone the repository
```bash
git clone https://github.com/UmarIqbal000/Clipzilla.git
cd Clipzilla
```

#### 2. Set up the Python environment

**Using `uv` (recommended):**
```bash
uv venv --python 3.11 .venv

# Windows (PowerShell)
.\.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate
```

**Using standard `venv`:**
```bash
python3.11 -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate
```

#### 3. Install Python dependencies
```bash
pip install -e .
```

Or using `requirements.txt`:
```bash
pip install -r requirements.txt && pip install -e .
```

#### 4. Install Web UI dependencies
```bash
cd web
npm install
cd ..
```

#### 5. Configure your LLM provider
```bash
cp config.yaml.example config.yaml
```

Edit `config.yaml` to set up your preferred LLM backend (see [LLM Provider Configurations](#-llm-provider-configurations)).

#### 6. Launch

Run both the FastAPI backend and React frontend with a single command:

```bash
python dev.py
```

This starts:

| Service | URL | Description |
|---|---|---|
| **React Web UI** | [http://localhost:5173](http://localhost:5173) | Main web interface |
| **FastAPI Backend** | [http://localhost:8000](http://localhost:8000) | REST API server |
| **Swagger Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API documentation |

Open [http://localhost:5173](http://localhost:5173) in your browser and you're ready to go! Press `Ctrl+C` to stop all services.

<details>
<summary><strong>Running Backend & Frontend Independently</strong></summary>

**Terminal 1 — Backend:**
```bash
# Windows (PowerShell)
$env:PYTHONPATH = "src"
uvicorn clipzilla.api.app:app --reload --host 127.0.0.1 --port 8000

# Linux / macOS
PYTHONPATH=src uvicorn clipzilla.api.app:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd web
npm run dev
```
</details>

<details>
<summary><strong>Building for Production</strong></summary>

```bash
cd web
npm run build
```

The built static files in `web/dist/` will be automatically served by the FastAPI backend at [http://localhost:8000](http://localhost:8000).
</details>

---

### Method 2: Using CLI Only (No Web UI)

If you don't need the Web UI, you can use Clipzilla purely through the command line after installing the Python package:

```bash
git clone https://github.com/UmarIqbal000/Clipzilla.git
cd Clipzilla
pip install -e .
cp config.yaml.example config.yaml
```

Then run the full pipeline:

```bash
clipzilla auto "https://www.youtube.com/watch?v=VIDEO_ID"
```

Or run individual stages — see [All CLI Commands](#-all-cli-commands) for the full reference.

---

### Method 3: Using Docker

Clipzilla provides a multi-stage Docker setup that packages the React frontend, FastAPI backend, FFmpeg with `libass` font support, and MediaPipe vision tools in a single container.

#### 1. Start with Docker Compose
```bash
docker compose up -d
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

#### 2. Volume Mounts & Persistence

| Host Path | Container Path | Purpose |
|---|---|---|
| `./workdir/` | `/app/workdir` | SQLite database, download cache, processing workspace |
| `./output/` | `/app/output` | Rendered vertical shorts and poster thumbnails |
| `./models/` | `/app/models` | Downloaded Faster-Whisper AI models (never downloaded twice) |
| `./config.yaml` | `/app/config.yaml` | Custom LLM configuration (read-only) |

#### 3. Connecting to Host Ollama

Inside the container, connect to Ollama running on your host machine:
```
http://host.docker.internal:11434/v1
```

#### 4. Running CLI Commands in Docker

```bash
# Generate 5 vertical shorts from a YouTube URL
docker compose run --rm clipzilla clipzilla auto "https://www.youtube.com/watch?v=VIDEO_ID" -n 5

# Run a custom clip
docker compose run --rm clipzilla clipzilla clip VIDEO_ID --start 10 --end 40
```

#### 5. NVIDIA GPU Acceleration (Optional)

If you have an NVIDIA GPU with the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

#### 6. Stop the Container
```bash
docker compose down
```

---

## ☁️ Deploying S3 & AWS Lambda Automation for Auto Publication

Instagram and Facebook **do not accept direct file uploads** — they require a publicly accessible URL pointing to the video. Clipzilla handles this automatically using **AWS S3 as a temporary hosting layer**.

### How It Works

1. When you publish a clip to Instagram or Facebook, Clipzilla uploads the rendered MP4 to your S3 bucket.
2. A **pre-signed URL** (valid for 1 hour) is generated and passed to the Meta Graph API.
3. After the platform finishes ingesting the video, Clipzilla **automatically deletes** the S3 object.

### Setup

#### 1. Create an S3 Bucket

Create a bucket in your preferred AWS region (e.g., `us-east-1`). No special public access is needed — Clipzilla uses pre-signed URLs.

#### 2. Create IAM Credentials

Create an IAM user (or use existing credentials) with the following permissions on your bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/clipzilla-temp/*"
    }
  ]
}
```

#### 3. Configure Credentials

**Via Web UI (recommended):**

Navigate to the **Accounts** screen → **Platform Credentials** tab and enter your AWS Access Key ID, Secret Access Key, S3 Bucket Name, and Region.

**Via `.env` file:**

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJal...
CLIPZILLA_S3_BUCKET=my-clipzilla-bucket
CLIPZILLA_S3_REGION=us-east-1
```

### AWS Lambda (Optional Enhancement)

For automated scheduled publishing at scale, you can deploy a Lambda function triggered by EventBridge (CloudWatch Events) that:

1. Polls Clipzilla's `/publish-jobs` API for scheduled publish jobs.
2. Triggers the publish workflow via the API.
3. Sends SNS notifications on success/failure.

> **Note:** The built-in publish worker already handles scheduled publishing with a 60-second polling interval. AWS Lambda is only needed if you want to decouple the scheduling layer for production-grade reliability.

---

## 🔗 Configuring Meta (Instagram + Facebook) & YouTube

### YouTube Configuration

YouTube publishing uses the **YouTube Data API v3** with OAuth 2.0.

#### 1. Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Enable the **YouTube Data API v3**.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**.
5. Set the application type to **Web application**.
6. Add `http://localhost:8000/social-accounts/oauth/callback` as an authorized redirect URI.
7. Copy the **Client ID** and **Client Secret**.

#### 2. Add Credentials to Clipzilla

**Via Web UI (recommended):**

Navigate to **Accounts** → **Platform Credentials** → enter your YouTube Client ID and Client Secret → Save.

**Via `.env` file:**

```env
YOUTUBE_CLIENT_ID=123456789.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-...
```

#### 3. Connect Your YouTube Channel

In the **Accounts** screen, click **"Connect YouTube"** → complete the OAuth flow in the popup → your channel is now linked.

---

### Meta (Instagram + Facebook) Configuration

Instagram and Facebook publishing use the **Meta Graph API** (v21.0).

#### 1. Create a Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Create a new app (choose **Business** type).
3. Under **App Settings → Basic**, copy the **App ID** and **App Secret**.
4. Add the **Facebook Login** product and set the Valid OAuth Redirect URI to:
   ```
   http://localhost:8000/social-accounts/oauth/callback
   ```
5. Enable the required permissions:
   - **Instagram**: `instagram_content_publish`, `instagram_basic`, `pages_read_engagement`
   - **Facebook**: `publish_video`, `pages_manage_posts`, `pages_read_engagement`

#### 2. Add Credentials to Clipzilla

**Via Web UI:**

Navigate to **Accounts** → **Platform Credentials** → enter your Meta App ID and App Secret → Save.

**Via `.env` file:**

```env
META_APP_ID=1234567890
META_APP_SECRET=abc123...
```

#### 3. Connect Your Accounts

- **Instagram**: Click **"Connect Instagram"** → complete the OAuth flow → select the Instagram Business/Creator account linked to your Facebook Page.
- **Facebook**: Click **"Connect Facebook"** → complete the OAuth flow → select the Facebook Page to publish to.

> **Important:** Instagram content publishing requires an Instagram Business or Creator account linked to a Facebook Page. Personal accounts are not supported by Meta's API.

---

## 📟 All CLI Commands

The `clipzilla` CLI is registered as a console script — after `pip install -e .`, it's available globally in your virtual environment.

### Command Overview

| Command | Purpose | Example |
|---|---|---|
| `clipzilla auto` | Full pipeline: URL → Vertical Shorts | `clipzilla auto "https://youtu.be/xyz"` |
| `clipzilla download` | Download a YouTube video + captions | `clipzilla download "https://youtu.be/xyz"` |
| `clipzilla transcribe` | Generate word-level transcript | `clipzilla transcribe` |
| `clipzilla analyze` | AI clip discovery from transcript | `clipzilla analyze` |
| `clipzilla clip` | Cut a custom short from timestamps | `clipzilla clip --start 10 --end 40` |

---

### `clipzilla auto` — One-Click Full Pipeline

The recommended way to use Clipzilla. Downloads, transcribes, analyzes, reframes, captions, and exports — all in one command.

```bash
clipzilla auto "https://www.youtube.com/watch?v=VIDEO_ID"
```

**All Options:**

| Flag | Default | Description |
|---|---|---|
| `URL` *(required)* | — | YouTube video URL |
| `--preset` | `karaoke` | Caption animation: `karaoke` or `single` |
| `--color` | `yellow` | Highlight color: `yellow`, `cyan`, `green`, `white`, or `#RRGGBB` |
| `--reframe` | `auto` | Reframe strategy: `auto`, `face`, `blur`, `center` |
| `--font` | `Arial` | Subtitle font family |
| `--position` | `bottom` | Subtitle position: `bottom`, `middle`, `top`, or integer margin |
| `-n` / `--clips` | Auto (3–8) | Target number of clips to generate |
| `-o` / `--output-dir` | `./output` | Directory for exported shorts |
| `--provider` | config | LLM provider override: `ollama_local`, `ollama_cloud`, `openai_compat` |
| `--model` | config | LLM model name override |
| `--workdir` | `./workdir` | Processing workspace directory |
| `--delete-source` / `--keep-source` | `--delete-source` | Delete original video after clipping |
| `--force` | Off | Force re-processing even if cached files exist |

**Examples:**

```bash
# Generate 5 shorts with single-word pop-up captions and cyan highlight
clipzilla auto "https://www.youtube.com/watch?v=VIDEO_ID" \
  --preset single --color cyan -n 5

# Use Groq as the LLM provider
clipzilla auto "https://www.youtube.com/watch?v=VIDEO_ID" \
  --provider openai_compat --model llama-3.3-70b-versatile

# Keep the source video and export to a custom directory
clipzilla auto "https://www.youtube.com/watch?v=VIDEO_ID" \
  --keep-source -o ./my-shorts/
```

---

### `clipzilla download` — Download Video

Downloads a YouTube video capped at 1080p with all available subtitles and metadata.

```bash
clipzilla download "https://www.youtube.com/watch?v=VIDEO_ID"
```

| Flag | Default | Description |
|---|---|---|
| `URL` *(required)* | — | YouTube video URL |
| `--workdir` | `./workdir` | Download destination |

Output: Creates `./workdir/<video_id>/` with `source.mp4`, `proxy.mp4`, subtitle files, and `metadata.json`.

---

### `clipzilla transcribe` — Generate Transcript

Converts downloaded captions or runs `faster-whisper` to produce word-level timestamps in `transcript.json`.

```bash
clipzilla transcribe [TARGET]
```

| Flag | Default | Description |
|---|---|---|
| `TARGET` *(optional)* | Auto-detect | Video ID, directory path, or omit to auto-detect |
| `--force-whisper` | Off | Run Whisper even when YouTube captions exist |
| `--model` | `base` | Whisper model: `tiny`, `base`, `small`, `medium`, `large-v3` |
| `--device` | Auto | Device: `cpu` or `cuda` |
| `--workdir` | `./workdir` | Working directory |

---

### `clipzilla analyze` — AI Clip Discovery

Sends the transcript to your configured LLM to identify high-retention moments.

```bash
clipzilla analyze [TARGET]
```

| Flag | Default | Description |
|---|---|---|
| `TARGET` *(optional)* | Auto-detect | Video ID or directory |
| `--provider` | config | LLM provider override |
| `--model` | config | LLM model override |
| `-n` / `--clips` | Auto | Target number of clips |
| `--config` | `config.yaml` | Path to custom config file |
| `--workdir` | `./workdir` | Working directory |

Output: Saves suggestions to `clips_suggested.json` with titles, hooks, timestamps, and heuristic scores.

---

### `clipzilla clip` — Cut a Custom Short

Cuts a specific time range into a 1080×1920 vertical short with reframing and animated subtitles.

```bash
clipzilla clip [TARGET] --start 10 --end 40
```

| Flag | Default | Description |
|---|---|---|
| `TARGET` *(optional)* | Auto-detect | Video ID, directory, or YouTube URL (auto-downloads) |
| `--start` *(required)* | — | Start time in seconds (`15`, `15.5`) or `HH:MM:SS` |
| `--end` *(required)* | — | End time in seconds or `HH:MM:SS` |
| `--output` | Auto-generated | Custom output file path |
| `--reframe` | `auto` | Reframe: `auto`, `face`, `blur`, `center` |
| `--preset` | `karaoke` | Caption preset: `karaoke` or `single` |
| `--font` | `Arial` | Font family |
| `--color` | `yellow` | Highlight color |
| `--position` | `bottom` | Subtitle vertical position |
| `--no-subtitles` | Off | Disable subtitle burning |
| `--delete-source` / `--keep-source` | `--keep-source` | Delete original after clipping |
| `--workdir` | `./workdir` | Working directory |

**Examples:**

```bash
# Karaoke highlight (default)
clipzilla clip --start 5 --end 25

# Single-word pop-up with cyan highlight
clipzilla clip --start 10 --end 30 --preset single --color cyan

# Blurred background fill (ideal for gameplay or tutorials)
clipzilla clip --start 10 --end 30 --reframe blur

# Custom output file
clipzilla clip VIDEO_ID --start 00:00:10 --end 00:00:40 --output shorts/my_short.mp4

# Clip directly from a URL (auto-downloads + transcribes first)
clipzilla clip "https://www.youtube.com/watch?v=VIDEO_ID" --start 15 --end 45
```

---

## ⚙️ Configurations

### `config.yaml`

Copy the example config to get started:

```bash
cp config.yaml.example config.yaml
```

### Full Configuration Reference

```yaml
# Active provider: "ollama_local", "ollama_cloud", or "openai_compat"
provider: ollama_local

# Default output directory for generated shorts
output_dir: output

# Delete original downloaded source video after clips are generated
delete_source: true

providers:
  ollama_local:
    base_url: "http://localhost:11434/v1"
    model: "llama3.2"

  ollama_cloud:
    base_url: "https://ollama.com/v1"
    api_key_env: "OLLAMA_API_KEY"
    model: "llama3.2"

  openai_compat:
    base_url: "https://api.groq.com/openai/v1"
    api_key_env: "GROQ_API_KEY"
    model: "llama-3.3-70b-versatile"
```

| Key | Type | Default | Description |
|---|---|---|---|
| `provider` | `string` | `ollama_local` | Active LLM provider type |
| `output_dir` | `string` | `output` | Default directory for exported shorts |
| `delete_source` | `bool` | `true` | Delete original source video after clips are generated |
| `providers.<type>.base_url` | `string` | — | LLM API endpoint URL |
| `providers.<type>.model` | `string` | — | Model name to use |
| `providers.<type>.api_key_env` | `string` | — | Environment variable name containing the API key |

### Environment Variables

API keys can be stored in a `.env` file at the project root:

```env
# LLM Provider Keys
OLLAMA_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here

# Social Publishing (Optional)
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret

# AWS S3 (Optional — for Instagram/Facebook publishing)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
CLIPZILLA_S3_BUCKET=your-bucket-name
CLIPZILLA_S3_REGION=us-east-1
```

When using the Web UI Settings page, API keys are automatically stored in `.env` with the naming convention `PROFILE_<ID>_KEY`.

---

## 🏗️ Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Clipzilla                                │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐     │
│  │   CLI (Click) │    │  Web UI      │    │ Social Publishers  │     │
│  │              │    │  React+Vite  │    │ YT / IG / FB       │     │
│  └──────┬───────┘    └──────┬───────┘    └──────┬─────────────┘     │
│         │                   │                   │                   │
│         │         ┌─────────▼───────────────────▼──────┐            │
│         │         │     FastAPI REST API               │            │
│         │         │     + Worker Queue                 │            │
│         │         │     + Publish Worker               │            │
│         │         │     + SQLite Database              │            │
│         │         └─────────┬──────────────────────────┘            │
│         │                   │                                       │
│  ┌──────▼───────────────────▼───────────────────────────┐           │
│  │              Core Pipeline Modules                    │           │
│  │                                                       │           │
│  │  ┌────────────┐  ┌──────────────┐                     │           │
│  │  │ Downloader │→ │ Transcriber  │                     │           │
│  │  │  (yt-dlp)  │  │(faster-whis.)│                     │           │
│  │  └────────────┘  └──────┬───────┘                     │           │
│  │                         │                             │           │
│  │  ┌────────────┐  ┌──────▼───────┐                     │           │
│  │  │ Heuristics │← │  Analyzer    │                     │           │
│  │  │            │  │  (LLM)       │                     │           │
│  │  └────────────┘  └──────┬───────┘                     │           │
│  │                         │                             │           │
│  │  ┌────────────┐  ┌──────▼───────┐  ┌──────────────┐  │           │
│  │  │ Subtitles  │← │  Reframe     │  │  S3 Host     │  │           │
│  │  │  (.ass)    │  │ (MediaPipe)  │  │  (boto3)     │  │           │
│  │  └─────┬──────┘  └──────┬───────┘  └──────────────┘  │           │
│  │        │                │                             │           │
│  │        └───────┬────────┘                             │           │
│  │         ┌──────▼───────┐                              │           │
│  │         │   Clipper    │                              │           │
│  │         │  (FFmpeg)    │                              │           │
│  │         └──────────────┘                              │           │
│  └───────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

### Pipeline Stages

| Stage | Module | Technology | Description |
|---|---|---|---|
| **1. Download** | `downloader.py` | yt-dlp | Fetches video (≤1080p), captions, metadata; generates 480p proxy |
| **2. Transcribe** | `transcriber.py`, `captions.py` | faster-whisper, WebVTT | Produces word-level `transcript.json` from captions or Whisper |
| **3. Analyze** | `analyzer.py`, `heuristics.py` | LLM + Pydantic | Discovers high-retention clips; validates with schema + boundary heuristics |
| **4. Reframe** | `reframe.py` | MediaPipe, OpenCV | Tracks speaker face; applies EMA smoothing; generates 9:16 crop path |
| **5. Caption** | `subtitles.py` | ASS format | Generates animated `.ass` subtitles (karaoke or single-word presets) |
| **6. Export** | `clipper.py` | FFmpeg | Burns subtitles, applies crop/blur, encodes `libx264`+`aac`, atomic writes |

### Project Structure

```
Clipzilla/
├── src/clipzilla/                 # Python backend package
│   ├── __init__.py                # Package metadata (v0.1.0)
│   ├── cli.py                     # Click-based CLI commands
│   ├── downloader.py              # YouTube video download + proxy generation
│   ├── transcriber.py             # Whisper transcription + caption conversion
│   ├── captions.py                # WebVTT/SRT parser → word-level timestamps
│   ├── analyzer.py                # LLM-powered clip discovery with Pydantic validation
│   ├── heuristics.py              # Sentence boundary scoring & trim suggestions
│   ├── reframe.py                 # MediaPipe face tracking + EMA smoothing + FFmpeg filters
│   ├── subtitles.py               # ASS subtitle generation (karaoke & single-word)
│   ├── clipper.py                 # FFmpeg clip cutting + subtitle burning
│   ├── schema.py                  # Pydantic models for clip validation
│   ├── config.py                  # YAML config loader + hardware detection
│   ├── presets.py                 # Platform export presets (YT Shorts, TikTok, Reels)
│   ├── api/                       # FastAPI REST API
│   │   ├── app.py                 # Routes, endpoints, static file serving
│   │   ├── worker.py              # Background job processing (producer-consumer queue)
│   │   ├── publish_worker.py      # Social media publish queue processor
│   │   ├── database.py            # SQLite storage for jobs, clips, history, social accounts
│   │   ├── settings.py            # Settings & profile CRUD, secret masking
│   │   ├── credentials.py         # Fernet-based credential encryption/decryption
│   │   ├── s3_host.py             # AWS S3 temporary video hosting for Meta API
│   │   └── publishers/            # Platform publisher integrations
│   │       ├── base.py            # Abstract base publisher class
│   │       ├── youtube.py         # YouTube Data API v3 (OAuth + resumable upload)
│   │       ├── instagram.py       # Instagram Graph API (Reels via S3 URL)
│   │       └── facebook.py        # Facebook Graph API (Page video via S3 URL)
│   └── llm/                       # LLM provider abstraction
│       ├── __init__.py            # Provider factory
│       ├── base.py                # Abstract base class + exceptions
│       └── providers.py           # Ollama Local/Cloud, OpenAI-compatible implementations
├── web/                           # React frontend
│   ├── src/
│   │   ├── App.jsx                # Root router + global state + job polling
│   │   ├── main.jsx               # React DOM mount
│   │   ├── index.css              # Tailwind directives + retro theme CSS
│   │   ├── api/client.js          # HTTP client with fallback + error handling
│   │   └── components/
│   │       ├── HomeScreen.jsx     # Video intake form + pipeline progress
│   │       ├── EditorScreen.jsx   # Timeline editor + typography studio
│   │       ├── ResultsScreen.jsx  # Shorts vault + inline editor drawer
│   │       ├── HistoryScreen.jsx  # Job archive + search + filtering
│   │       ├── BatchDetailScreen.jsx  # Single batch detail view
│   │       ├── SettingsScreen.jsx # AI provider engine management
│   │       ├── AccountsScreen.jsx # Social accounts + OAuth + credentials
│   │       ├── PublishModal.jsx   # Multi-platform publish dialog
│   │       ├── Navbar.jsx         # Global navigation bar
│   │       ├── MarqueeTicker.jsx  # Scrolling celluloid ticker tape
│   │       ├── PillBadge.jsx      # Reusable pill/badge component
│   │       ├── StatBlockRow.jsx   # Metric statistics banner
│   │       └── TopAnnouncementStrip.jsx  # Top announcement ribbon
│   ├── public/                    # Static assets (logo, favicon)
│   ├── index.html                 # HTML entry with Google Fonts
│   ├── vite.config.js             # Vite config with API proxy
│   ├── tailwind.config.js         # Custom design tokens & animations
│   └── package.json               # Frontend dependencies
├── tests/                         # Test suite (17 test files)
├── models/                        # Auto-downloaded AI models (gitignored)
├── workdir/                       # Processing workspace (gitignored)
├── assets/                        # README images
├── config.yaml.example            # Example configuration template
├── dev.py                         # Full-stack dev runner script
├── Dockerfile                     # Multi-stage Docker build
├── docker-compose.yml             # Container orchestration
├── docker-compose.gpu.yml         # NVIDIA GPU overlay
├── pyproject.toml                 # Python project metadata
├── requirements.txt               # Python dependencies
└── .env                           # API keys (gitignored)
```

### Workspace Layout

Each processed video creates a structured workspace:

```
workdir/
└── <video_id>/
    ├── source.mp4                      # Downloaded 1080p source video
    ├── proxy.mp4                       # 480p fast-start proxy for web scrubbing
    ├── source.en.vtt                   # YouTube captions (if available)
    ├── metadata.json                   # Video title, duration, channel info
    ├── transcript.json                 # Standardized word-level transcript
    ├── clips_suggested.json            # AI-suggested clips with titles & hooks
    ├── subtitles_5_00_25_00.ass        # Generated animated ASS subtitles
    ├── crop_<clip_id>.json             # Cached speaker crop path data
    └── clips/                          # Exported shorts
        ├── clip_01_Python_Basics.mp4
        ├── clip_02_Why_Zen_Code.mp4
        └── ...
```

### API Reference

The FastAPI backend provides a comprehensive REST API. Interactive Swagger documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs) when the server is running.

#### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/jobs` | Submit a new video processing job (single or batch) |
| `GET` | `/jobs` | List all recent jobs |
| `GET` | `/jobs/{id}` | Get job status, progress, and stage info |
| `GET` | `/jobs/{id}/clips` | List all clips generated for a job |
| `DELETE` | `/jobs/{id}` | Delete a job from history |
| `GET` | `/clips` | List all clips across all jobs |
| `GET` | `/clips/{id}` | Get clip metadata |
| `GET` | `/clips/{id}/video` | Stream the rendered MP4 short |
| `GET` | `/clips/{id}/thumbnail` | Stream the poster frame thumbnail |
| `GET` | `/clips/{id}/proxy` | Stream the 480p proxy video |
| `DELETE` | `/clips/{id}` | Delete a clip |

#### Editor Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/clips/{id}/editor-data` | Full timeline data (captions, crop path, styles) |
| `POST` | `/clips/{id}/edits` | Save trim, caption, style, and crop edits |
| `POST` | `/clips/{id}/rerender` | Trigger isolated single-clip re-render |

#### Batch & History

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/batches` | Submit a batch of URLs |
| `GET` | `/batches/{id}` | Get batch status and progress |
| `GET` | `/batches/{id}/clips` | List clips in a batch |
| `GET` | `/history` | Get full processing history |
| `DELETE` | `/history/failed` | Purge all failed jobs |

#### Settings & Profiles

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/settings` | Get current configuration |
| `POST` | `/settings` | Update configuration |
| `GET` | `/settings/profiles` | List all LLM provider profiles |
| `POST` | `/settings/profiles` | Create or update a profile |
| `DELETE` | `/settings/profiles/{id}` | Delete a profile |
| `POST` | `/settings/active-profile` | Switch the active LLM profile |
| `GET` | `/presets` | List available export presets |

#### Social Accounts & Publishing

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/social-accounts` | List all connected social accounts |
| `GET` | `/social-accounts/{id}` | Get account details |
| `PATCH` | `/social-accounts/{id}` | Update account name/status |
| `DELETE` | `/social-accounts/{id}` | Disconnect and remove account |
| `GET` | `/social-accounts/credentials/status` | Check which platform credentials are configured |
| `POST` | `/social-accounts/credentials` | Save platform API credentials |
| `POST` | `/social-accounts/direct-connect` | Add account via tokens/keys |
| `GET/POST` | `/social-accounts/oauth/{platform}/start` | Start OAuth flow |
| `GET` | `/social-accounts/oauth/callback` | OAuth redirect callback |
| `POST` | `/social-accounts/oauth/{platform}/complete` | Exchange auth code for tokens |
| `POST` | `/clips/{id}/publish` | Publish clip to one or more platforms |
| `GET` | `/clips/{id}/publish-history` | Get publish history for a clip |
| `GET` | `/publish-jobs/{id}` | Get publish job status |

---

## 🧪 Testing

### Running All Tests

```bash
python -m pytest tests/ -v
```

### Running Specific Test Categories

```bash
# Core pipeline tests
python -m pytest tests/test_reframe.py tests/test_captions.py tests/test_cli.py -v

# LLM and analysis tests
python -m pytest tests/test_llm_providers.py tests/test_heuristics.py tests/test_analyzer.py -v

# API and integration tests
python -m pytest tests/test_api.py tests/test_pipeline.py tests/test_batch_history.py -v

# Configuration and settings tests
python -m pytest tests/test_config.py tests/test_profiles.py tests/test_export_presets.py -v

# Social publishing tests
python -m pytest tests/test_social_publishing.py -v

# Cleanup and edge-case tests
python -m pytest tests/test_delete_source_and_output.py tests/test_proxy.py tests/test_reframe_overrides.py -v
```

### Test Coverage Matrix

| Test File | Coverage Area | What It Tests |
|---|---|---|
| `test_reframe.py` | Face Tracking | MediaPipe face detection, EMA smoothing, crop path generation |
| `test_reframe_overrides.py` | Crop Modes | Override strategies: center, left, right, blur |
| `test_captions.py` | Caption Parsing | WebVTT/SRT parsing, word-level timestamp conversion |
| `test_cli.py` | CLI Commands | Command validation, argument parsing, Click integration |
| `test_llm_providers.py` | LLM Providers | Provider instantiation, API calls, error handling |
| `test_heuristics.py` | Boundary Scoring | Sentence boundary detection, trim suggestions |
| `test_analyzer.py` | Clip Analysis | Pydantic validation, LLM response parsing, error correction |
| `test_config.py` | Configuration | YAML loading, hardware detection, default profiles |
| `test_api.py` | REST API | Endpoint responses, request validation, error codes |
| `test_pipeline.py` | End-to-End | Full pipeline orchestration, stage chaining |
| `test_batch_history.py` | Batch Jobs | Batch processing, history queries |
| `test_export_presets.py` | Export Presets | Platform preset validation, bitrate/duration constraints |
| `test_delete_source_and_output.py` | Cleanup | Source deletion, disk management, file lock handling |
| `test_profiles.py` | Profile CRUD | Profile create/read/update/delete, active profile switching |
| `test_proxy.py` | Proxy Generation | 480p proxy video creation |
| `test_social_publishing.py` | Social Publishing | OAuth flows, publisher integrations, publish job processing |

---

## 🛠️ Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| **Python 3.11+** | Core runtime |
| **FastAPI + Uvicorn** | REST API & async web server |
| **Click** | CLI framework |
| **yt-dlp** | YouTube video downloading |
| **faster-whisper** | Speech-to-text transcription (CTranslate2, `int8`) |
| **MediaPipe** | Face detection & speaker tracking |
| **OpenCV** | Video frame sampling |
| **FFmpeg** | Video processing, cropping, subtitle burning |
| **Pydantic** | Data validation & schema enforcement |
| **httpx** | Async HTTP client for LLM API calls |
| **SQLite** | Job, clip, and social account metadata storage |
| **python-dotenv** | Environment variable management |
| **google-api-python-client** | YouTube Data API v3 integration |
| **google-auth-oauthlib** | Google OAuth 2.0 authentication |
| **boto3** | AWS S3 temporary video hosting |
| **cryptography** | Fernet-based credential encryption |

### Frontend

| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **Vite 5** | Build tool & dev server |
| **Tailwind CSS 3** | Utility-first styling |
| **Lucide React** | Icon library |
| **Google Fonts** | Anton, Bebas Neue, Newsreader, Plus Jakarta Sans |

---

## 🔧 Troubleshooting

<details>
<summary><strong>FFmpeg not found</strong></summary>

Ensure FFmpeg is installed and available in your system `PATH`:
```bash
ffmpeg -version
```
- **Windows**: `choco install ffmpeg`
- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt install ffmpeg`
</details>

<details>
<summary><strong>CUDA errors with faster-whisper</strong></summary>

Clipzilla automatically falls back to CPU `int8` quantization if CUDA libraries are unavailable. No GPU is required. If you have a GPU but see errors, ensure your CUDA toolkit matches the version expected by CTranslate2.
</details>

<details>
<summary><strong>Port already in use</strong></summary>

If port 8000 or 5173 is already in use:
```bash
# Check what's using the port (Windows)
netstat -ano | findstr :8000

# Kill the process
taskkill /PID <pid> /F
```

```bash
# Linux / macOS
lsof -i :8000
kill -9 <pid>
```
</details>

<details>
<summary><strong>Windows file lock errors on source deletion</strong></summary>

Clipzilla handles Windows file locks with automatic garbage collection and retry backoffs. If you still encounter issues, ensure no other application (media player, file explorer preview) has the video file open.
</details>

<details>
<summary><strong>Web UI can't connect to backend</strong></summary>

The Vite dev server proxies API requests to `http://127.0.0.1:8000`. Ensure the backend is running. The frontend includes an automatic fallback to connect directly to the backend if the proxy fails.
</details>

<details>
<summary><strong>LLM connection refused / timeout</strong></summary>

- **Ollama Local**: Ensure Ollama is running (`ollama serve`) and the model is pulled (`ollama run llama3.2`).
- **Cloud providers**: Verify your API key is set in `.env` or as an environment variable, and that the `base_url` in `config.yaml` is correct.
- The default LLM request timeout is 120 seconds — large models may need more time on slower hardware.
</details>

<details>
<summary><strong>Instagram/Facebook publish fails with "S3 bucket not configured"</strong></summary>

Instagram and Facebook require videos to be hosted at a public URL. Configure your AWS S3 credentials via the **Accounts** screen or `.env` file. See the [Deploying S3 & AWS Lambda](#️-deploying-s3--aws-lambda-automation-for-auto-publication) section.
</details>

<details>
<summary><strong>YouTube OAuth "Access blocked" error</strong></summary>

If your Google Cloud project is in "Testing" mode, only test users listed in the OAuth consent screen can authorize. Add your Google account as a test user, or submit the app for verification.
</details>

<details>
<summary><strong>Docker can't connect to host Ollama</strong></summary>

Use `http://host.docker.internal:11434/v1` as the `base_url` in your `config.yaml`. This resolves to your host machine's network from inside the Docker container. Ensure Ollama is running and listening on all interfaces (`OLLAMA_HOST=0.0.0.0 ollama serve`).
</details>

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make** your changes and add tests if applicable
4. **Run** the test suite:
   ```bash
   python -m pytest tests/ -v
   ```
5. **Commit** your changes:
   ```bash
   git commit -m "Add amazing feature"
   ```
6. **Push** to the branch:
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open** a Pull Request

### Development Setup

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
python -m pytest tests/ -v

# Start the full-stack dev environment
python dev.py
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this software for any purpose, commercial or non-commercial, as long as the original copyright notice and license terms are included.

---

<p align="center">
  <strong>🦖 Built with Clipzilla — Devour Long-Form. Spit Out Shorts.</strong>
</p>

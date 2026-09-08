# ==============================================================================
# Stage 1: Build Vite React Frontend
# ==============================================================================
FROM node:20-slim AS frontend-builder
WORKDIR /app/web

# Install dependencies
COPY web/package.json web/package-lock.json* ./
RUN npm install

# Build static production bundle
COPY web/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Python 3.11 Runtime with FFmpeg & Vision Libraries
# ==============================================================================
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    CLIPZILLA_WORKDIR=/app/workdir \
    CLIPZILLA_OUTPUT_DIR=/app/output \
    CLIPZILLA_MODELS_DIR=/app/models \
    CLIPZILLA_DB_PATH=/app/workdir/clipzilla.db \
    CLIPZILLA_CONFIG_PATH=/app/config.yaml

WORKDIR /app

# Install system dependencies:
# - ffmpeg: audio/video slicing, reframing, ASS subtitle burning
# - libgl1, libglib2.0-0: OpenCV and MediaPipe face tracking dependencies
# - fontconfig, fonts-dejavu-core, fonts-liberation: TrueType fonts for libass subtitles
# - curl: container healthcheck probe
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    fontconfig \
    fonts-dejavu-core \
    fonts-liberation \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for optimal Docker layer caching
COPY pyproject.toml requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code and config templates
COPY src/ ./src
COPY config.yaml.example ./config.yaml.example
COPY README.md ./

# Install Clipzilla package (provides the `clipzilla` CLI command)
RUN pip install --no-cache-dir -e .

# Copy built frontend assets from Stage 1 into /app/web/dist
COPY --from=frontend-builder /app/web/dist ./web/dist

# Ensure operational persistence directories exist
RUN mkdir -p /app/workdir /app/output /app/models

# Expose FastAPI & Web UI port
EXPOSE 8000

# Container health probe
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default startup command: Launch FastAPI with Uvicorn
CMD ["uvicorn", "clipzilla.api.app:app", "--host", "0.0.0.0", "--port", "8000"]

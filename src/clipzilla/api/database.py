import sqlite3
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

from clipzilla.config import DEFAULT_WORKDIR


def get_db_path() -> Path:
    DEFAULT_WORKDIR.mkdir(parents=True, exist_ok=True)
    return DEFAULT_WORKDIR / "clipzilla.db"


def get_db():
    conn = sqlite3.connect(str(get_db_path()), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes SQLite database tables for jobs and generated clips."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            video_id TEXT,
            status TEXT NOT NULL,
            progress INTEGER NOT NULL DEFAULT 0,
            stage_message TEXT,
            error_message TEXT,
            preset TEXT DEFAULT 'karaoke',
            reframe TEXT DEFAULT 'auto',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS clips (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            video_id TEXT NOT NULL,
            title TEXT NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            duration REAL NOT NULL,
            reason TEXT,
            needs_trimming INTEGER DEFAULT 0,
            trimming_notes TEXT,
            file_path TEXT NOT NULL,
            thumbnail_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        )
        """
    )

    conn.commit()
    conn.close()


def create_job(job_id: str, url: str, preset: str = "karaoke", reframe: str = "auto") -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO jobs (id, url, status, progress, stage_message, preset, reframe, created_at, updated_at)
        VALUES (?, ?, 'queued', 0, 'Job queued for processing', ?, ?, ?, ?)
        """,
        (job_id, url, preset, reframe, datetime.utcnow(), datetime.utcnow()),
    )
    conn.commit()
    conn.close()
    return get_job(job_id)


def update_job_status(
    job_id: str,
    status: str,
    progress: int,
    stage_message: Optional[str] = None,
    error_message: Optional[str] = None,
    video_id: Optional[str] = None,
):
    conn = get_db()
    cursor = conn.cursor()

    fields = ["status = ?", "progress = ?", "updated_at = ?"]
    params = [status, progress, datetime.utcnow()]

    if stage_message is not None:
        fields.append("stage_message = ?")
        params.append(stage_message)
    if error_message is not None:
        fields.append("error_message = ?")
        params.append(error_message)
    if video_id is not None:
        fields.append("video_id = ?")
        params.append(video_id)

    params.append(job_id)
    query = f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def list_jobs(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_clip(
    clip_id: str,
    job_id: str,
    video_id: str,
    title: str,
    start_time: float,
    end_time: float,
    duration: float,
    reason: str,
    needs_trimming: bool,
    trimming_notes: str,
    file_path: str,
    thumbnail_path: Optional[str] = None,
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO clips (
            id, job_id, video_id, title, start_time, end_time, duration,
            reason, needs_trimming, trimming_notes, file_path, thumbnail_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            clip_id,
            job_id,
            video_id,
            title,
            start_time,
            end_time,
            duration,
            reason,
            1 if needs_trimming else 0,
            trimming_notes,
            str(file_path),
            str(thumbnail_path) if thumbnail_path else None,
        ),
    )
    conn.commit()
    conn.close()


def get_clips_for_job(job_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM clips WHERE job_id = ? ORDER BY start_time ASC", (job_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_clip(clip_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM clips WHERE id = ?", (clip_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

import sqlite3
import json
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
            edits TEXT,
            render_status TEXT DEFAULT 'idle',
            render_error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        )
        """
    )

    # Automatic migration for existing databases
    cursor.execute("PRAGMA table_info(clips)")
    columns = [row[1] for row in cursor.fetchall()]
    if "edits" not in columns:
        cursor.execute("ALTER TABLE clips ADD COLUMN edits TEXT")
    if "render_status" not in columns:
        cursor.execute("ALTER TABLE clips ADD COLUMN render_status TEXT DEFAULT 'idle'")
    if "render_error" not in columns:
        cursor.execute("ALTER TABLE clips ADD COLUMN render_error TEXT")
    if "updated_at" not in columns:
        cursor.execute("ALTER TABLE clips ADD COLUMN updated_at TIMESTAMP")

    cursor.execute("PRAGMA table_info(jobs)")
    job_columns = [row[1] for row in cursor.fetchall()]
    if "batch_id" not in job_columns:
        cursor.execute("ALTER TABLE jobs ADD COLUMN batch_id TEXT")
    if "export_preset" not in job_columns:
        cursor.execute("ALTER TABLE jobs ADD COLUMN export_preset TEXT DEFAULT 'youtube_shorts'")
    if "profile_id" not in job_columns:
        cursor.execute("ALTER TABLE jobs ADD COLUMN profile_id TEXT")
    if "video_title" not in job_columns:
        cursor.execute("ALTER TABLE jobs ADD COLUMN video_title TEXT")

    # Mark any orphaned in-flight jobs from prior killed processes as failed
    cursor.execute(
        """
        UPDATE jobs
        SET status = 'failed',
            stage_message = 'Interrupted by server restart',
            error_message = 'Process terminated before completion'
        WHERE status IN ('queued', 'downloading', 'transcribing', 'analyzing', 'rendering')
        """
    )

    conn.commit()
    conn.close()


def cleanup_stale_jobs():
    """Manually resets any stuck in-flight jobs to failed."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE jobs
        SET status = 'failed',
            stage_message = 'Dismissed or interrupted',
            error_message = 'Job cancelled or reset'
        WHERE status IN ('queued', 'downloading', 'transcribing', 'analyzing', 'rendering')
        """
    )
    conn.commit()
    conn.close()


def create_job(
    job_id: str,
    url: str,
    preset: str = "karaoke",
    reframe: str = "auto",
    batch_id: Optional[str] = None,
    export_preset: str = "youtube_shorts",
    profile_id: Optional[str] = None,
    video_title: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO jobs (
            id, url, status, progress, stage_message, preset, reframe,
            batch_id, export_preset, profile_id, video_title, created_at, updated_at
        ) VALUES (?, ?, 'queued', 0, 'Job queued for processing', ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            job_id,
            url,
            preset,
            reframe,
            batch_id,
            export_preset,
            profile_id,
            video_title,
            datetime.utcnow(),
            datetime.utcnow(),
        ),
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
    video_title: Optional[str] = None,
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
    if video_title is not None:
        fields.append("video_title = ?")
        params.append(video_title)

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


def get_jobs_by_batch(batch_id: str) -> List[Dict[str, Any]]:
    """Returns all jobs belonging to a given batch_id."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE batch_id = ? ORDER BY created_at ASC", (batch_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_clips_by_batch(batch_id: str) -> List[Dict[str, Any]]:
    """Returns all clips across all jobs in a batch, with video_title and source_url."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT c.*, j.url as source_url, j.video_title, j.export_preset
        FROM clips c
        JOIN jobs j ON c.job_id = j.id
        WHERE j.batch_id = ?
        ORDER BY j.created_at ASC, c.start_time ASC
        """,
        (batch_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_project_history(limit: int = 100) -> List[Dict[str, Any]]:
    """Returns past jobs with aggregated clip counts, latest first."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT 
            j.id,
            j.batch_id,
            j.url,
            j.video_id,
            j.video_title,
            j.status,
            j.progress,
            j.stage_message,
            j.error_message,
            j.preset,
            j.reframe,
            j.export_preset,
            j.profile_id,
            j.created_at,
            j.updated_at,
            COUNT(c.id) as clip_count
        FROM jobs j
        LEFT JOIN clips c ON j.id = c.job_id
        GROUP BY j.id
        ORDER BY j.created_at DESC
        LIMIT ?
        """,
        (limit,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_job(job_id: str):
    """Deletes a job and associated clips from the database."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM clips WHERE job_id = ?", (job_id,))
    cursor.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()


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
    if not row:
        return None
    res = dict(row)
    if res.get("edits"):
        try:
            res["edits"] = json.loads(res["edits"])
        except Exception:
            pass
    return res


def update_clip_edits(clip_id: str, edits: Dict[str, Any]):
    """Saves user edits payload for a clip."""
    conn = get_db()
    cursor = conn.cursor()
    edits_json = json.dumps(edits) if edits else None
    cursor.execute(
        """
        UPDATE clips
        SET edits = ?, updated_at = ?
        WHERE id = ?
        """,
        (edits_json, datetime.utcnow(), clip_id),
    )
    conn.commit()
    conn.close()


def update_clip_render_status(clip_id: str, status: str, error: Optional[str] = None):
    """Updates render status ('idle', 'rendering', 'failed') and optional error."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE clips
        SET render_status = ?, render_error = ?, updated_at = ?
        WHERE id = ?
        """,
        (status, error, datetime.utcnow(), clip_id),
    )
    conn.commit()
    conn.close()


def update_clip_rendered(
    clip_id: str,
    start_time: float,
    end_time: float,
    duration: float,
    file_path: str,
    thumbnail_path: Optional[str] = None,
):
    """Updates clip after a successful re-render."""
    conn = get_db()
    cursor = conn.cursor()
    fields = [
        "start_time = ?",
        "end_time = ?",
        "duration = ?",
        "file_path = ?",
        "render_status = 'idle'",
        "render_error = NULL",
        "updated_at = ?",
    ]
    params = [start_time, end_time, duration, str(file_path), datetime.utcnow()]

    if thumbnail_path:
        fields.append("thumbnail_path = ?")
        params.append(str(thumbnail_path))

    params.append(clip_id)
    query = f"UPDATE clips SET {', '.join(fields)} WHERE id = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()


import logging
import threading
from collections import deque
from datetime import datetime
from typing import Dict, Any, List, Optional

class RuntimeLogBuffer(logging.Handler):
    """
    Captures runtime logs in-memory for streaming to the web UI terminal.
    Maintains a global ring buffer and per-job collections.
    """
    def __init__(self, max_records: int = 1000):
        super().__init__()
        self.max_records = max_records
        self.records: deque = deque(maxlen=max_records)
        self.job_logs: Dict[str, deque] = {}
        self.current_active_job_id: Optional[str] = None
        self._lock = threading.Lock()

    def set_active_job(self, job_id: Optional[str]):
        with self._lock:
            self.current_active_job_id = job_id
            if job_id and job_id not in self.job_logs:
                self.job_logs[job_id] = deque(maxlen=500)

    def add_entry(self, message: str, level: str = "INFO", name: str = "runtime", job_id: Optional[str] = None):
        target_job = job_id or self.current_active_job_id
        entry = {
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "level": level.upper(),
            "name": name,
            "message": str(message).strip(),
            "job_id": target_job,
        }
        with self._lock:
            self.records.append(entry)
            if target_job:
                if target_job not in self.job_logs:
                    self.job_logs[target_job] = deque(maxlen=500)
                self.job_logs[target_job].append(entry)

    def emit(self, record: logging.LogRecord):
        try:
            msg = self.format(record)
            name = record.name
            if name.startswith("clipzilla."):
                name = name[len("clipzilla."):]
            elif name == "clipzilla":
                name = "core"
            job_id = getattr(record, "job_id", None) or self.current_active_job_id
            self.add_entry(
                message=msg,
                level=record.levelname,
                name=name,
                job_id=job_id,
            )
        except Exception:
            self.handleError(record)

    def get_logs(self, job_id: Optional[str] = None, limit: int = 150) -> List[Dict[str, Any]]:
        with self._lock:
            if job_id and job_id in self.job_logs and len(self.job_logs[job_id]) > 0:
                return list(self.job_logs[job_id])[-limit:]
            return list(self.records)[-limit:]


# Global singleton
log_buffer = RuntimeLogBuffer()
_is_setup = False


def setup_logging_capture():
    global _is_setup
    if _is_setup:
        return
    formatter = logging.Formatter("%(message)s")
    log_buffer.setFormatter(formatter)

    # Capture clipzilla logger output
    cz_logger = logging.getLogger("clipzilla")
    cz_logger.setLevel(logging.INFO)
    cz_logger.addHandler(log_buffer)

    # Also capture root logger output for library events (ffmpeg, httpx, etc.)
    root_logger = logging.getLogger()
    root_logger.addHandler(log_buffer)

    _is_setup = True
    log_buffer.add_entry("Clipzilla runtime log daemon active.", level="INFO", name="system")


def record_job_log(message: str, level: str = "INFO", name: str = "worker", job_id: Optional[str] = None):
    """Convenience helper to record an explicit log event for a job."""
    log_buffer.add_entry(message=message, level=level, name=name, job_id=job_id)

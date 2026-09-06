#!/usr/bin/env python
"""
Clipzilla Dev Runner
Spins up both the FastAPI backend (Uvicorn) and the React frontend (Vite) concurrently.
"""

import sys
import os
import signal
import subprocess
import time
from pathlib import Path


def main():
    root_dir = Path(__file__).resolve().parent
    web_dir = root_dir / "web"

    print("=" * 65)
    print("🦖  Starting Clipzilla Full-Stack Local Environment...")
    print("=" * 65)

    env = os.environ.copy()
    env["PYTHONPATH"] = str(root_dir / "src")

    # 1. Start FastAPI backend with uvicorn
    backend_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "clipzilla.api.app:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--reload",
    ]

    print("[Clipzilla API] Launching on http://127.0.0.1:8000 (Docs: http://127.0.0.1:8000/docs)")
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(root_dir),
        env=env,
    )

    # 2. Start Vite dev server in web/
    # On Windows, npm is npm.cmd
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]

    print("[Clipzilla Web] Launching Vite on http://localhost:5173")
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=str(web_dir),
        shell=(sys.platform == "win32"),
    )

    print("\n🚀 Clipzilla is running!")
    print("👉 Open http://localhost:5173 in your browser")
    print("Press Ctrl+C to stop all services.\n")

    def cleanup(signum=None, frame=None):
        print("\n🛑 Shutting down Clipzilla services...")
        try:
            frontend_proc.terminate()
        except Exception:
            pass
        try:
            backend_proc.terminate()
        except Exception:
            pass

        time.sleep(0.5)
        try:
            frontend_proc.kill()
        except Exception:
            pass
        try:
            backend_proc.kill()
        except Exception:
            pass
        print("Done. Goodbye! 🦖")
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    try:
        while True:
            # Check if any process exited unexpectedly
            if backend_proc.poll() is not None:
                print(f"[Clipzilla API] Process terminated with code {backend_proc.returncode}")
                cleanup()
            if frontend_proc.poll() is not None:
                print(f"[Clipzilla Web] Process terminated with code {frontend_proc.returncode}")
                cleanup()
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()

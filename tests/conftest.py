import os
import pytest
from pathlib import Path


@pytest.fixture(autouse=True)
def isolate_test_db(tmp_path):
    """Ensures every pytest test uses an isolated SQLite database and never touches workdir/clipzilla.db."""
    test_db = tmp_path / "test_clipzilla.db"
    old_env = os.environ.get("CLIPZILLA_DB_PATH")
    os.environ["CLIPZILLA_DB_PATH"] = str(test_db)
    from clipzilla.api.database import init_db
    init_db()
    yield test_db
    if old_env is not None:
        os.environ["CLIPZILLA_DB_PATH"] = old_env
    else:
        os.environ.pop("CLIPZILLA_DB_PATH", None)

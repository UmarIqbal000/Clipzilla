"""Credential encryption for social media OAuth tokens.
 
Uses Fernet symmetric encryption to protect access/refresh tokens at rest in SQLite.
The encryption key is stored locally at workdir/.clipzilla_key and generated once on first use.
"""
import json
import os
from pathlib import Path
from cryptography.fernet import Fernet
from clipzilla.config import DEFAULT_WORKDIR


KEY_FILE = DEFAULT_WORKDIR / ".clipzilla_key"


def _get_or_create_key() -> bytes:
    """Returns the local Fernet key, creating one if it doesn't exist."""
    if KEY_FILE.exists():
        return KEY_FILE.read_bytes()
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    key = Fernet.generate_key()
    KEY_FILE.write_bytes(key)
    # Restrict file permissions on Unix systems
    try:
        os.chmod(str(KEY_FILE), 0o600)
    except (OSError, AttributeError):
        pass  # Windows doesn't support chmod the same way
    return key


def get_fernet() -> Fernet:
    return Fernet(_get_or_create_key())


def encrypt_credentials(data: dict) -> str:
    """Encrypts a credentials dict to a base64 string for DB storage."""
    f = get_fernet()
    json_bytes = json.dumps(data).encode("utf-8")
    return f.encrypt(json_bytes).decode("utf-8")


def decrypt_credentials(encrypted: str) -> dict:
    """Decrypts a stored credential string back to a dict."""
    f = get_fernet()
    json_bytes = f.decrypt(encrypted.encode("utf-8"))
    return json.loads(json_bytes.decode("utf-8"))

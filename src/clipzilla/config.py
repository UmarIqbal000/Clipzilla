from pathlib import Path
import os
import yaml
from typing import Dict, Any, Optional
import ctranslate2

# Default directory paths
DEFAULT_WORKDIR = Path("workdir")
DEFAULT_MODELS_DIR = Path("models")
DEFAULT_CONFIG_PATH = Path("config.yaml")

# Video short dimensions (vertical 9:16)
TARGET_WIDTH = 1080
TARGET_HEIGHT = 1920


def is_cuda_functional() -> bool:
    """Checks if CUDA is both detected and has functional runtime libraries."""
    try:
        if ctranslate2.get_cuda_device_count() > 0:
            ctranslate2.StorageView.from_array([1.0]).to("cuda")
            return True
    except Exception:
        return False
    return False


def get_default_device() -> str:
    """
    Returns 'cuda' if a functional CUDA GPU is present, else 'cpu'.
    Defaults to CPU if GPU or CUDA DLLs are missing.
    """
    if is_cuda_functional():
        return "cuda"
    return "cpu"


def get_default_compute_type(device: str) -> str:
    """Returns 'int8' for CPU / GPU, with graceful compatibility."""
    return "int8"


DEFAULT_APP_CONFIG: Dict[str, Any] = {
    "provider": "ollama_local",
    "providers": {
        "ollama_local": {
            "base_url": "http://localhost:11434/v1",
            "model": "llama3.2",
        },
        "ollama_cloud": {
            "base_url": "https://ollama.com/v1",
            "api_key_env": "OLLAMA_API_KEY",
            "model": "llama3.2",
        },
        "openai_compat": {
            "base_url": "https://api.groq.com/openai/v1",
            "api_key_env": "GROQ_API_KEY",
            "model": "llama-3.3-70b-versatile",
        },
    },
}


def load_config(config_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Loads configuration from YAML file.
    Falls back to environment variable CLIPZILLA_CONFIG or default config.yaml.
    If file doesn't exist, returns default configuration.
    """
    target = config_path
    if not target:
        env_path = os.environ.get("CLIPZILLA_CONFIG")
        if env_path:
            target = Path(env_path)
        else:
            target = DEFAULT_CONFIG_PATH

    if target and target.exists():
        try:
            with open(target, "r", encoding="utf-8") as f:
                loaded = yaml.safe_load(f)
                if isinstance(loaded, dict):
                    # Merge with defaults
                    merged = DEFAULT_APP_CONFIG.copy()
                    merged.update(loaded)
                    return merged
        except Exception:
            pass

    return DEFAULT_APP_CONFIG.copy()


def get_llm_provider(
    config_path: Optional[Path] = None,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
):
    """
    Factory function returning the configured LLMProvider instance.
    Supports switching providers via config.yaml or overrides.
    """
    # Import locally to avoid circular imports
    from clipzilla.llm.providers import (
        OllamaLocalProvider,
        OllamaCloudProvider,
        OpenAICompatProvider,
    )

    config = load_config(config_path)
    active_provider_name = provider_override or config.get("provider", "ollama_local")
    providers_config = config.get("providers", {})
    provider_settings = providers_config.get(active_provider_name, {})

    base_url = provider_settings.get("base_url")
    model = model_override or provider_settings.get("model", "llama3.2")
    api_key = provider_settings.get("api_key")

    # Check env var for API key
    api_key_env = provider_settings.get("api_key_env")
    if not api_key and api_key_env:
        api_key = os.environ.get(api_key_env)

    if active_provider_name == "ollama_local":
        return OllamaLocalProvider(
            base_url=base_url or "http://localhost:11434/v1",
            default_model=model,
        )
    elif active_provider_name == "ollama_cloud":
        return OllamaCloudProvider(
            base_url=base_url or "https://ollama.com/v1",
            api_key=api_key,
            default_model=model,
        )
    else:
        # Generic OpenAI-compatible
        return OpenAICompatProvider(
            base_url=base_url or "http://localhost:11434/v1",
            api_key=api_key,
            default_model=model,
        )

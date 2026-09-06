from pathlib import Path
import os
import yaml
from typing import Dict, Any, Optional
import ctranslate2
from dotenv import load_dotenv

load_dotenv()


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


DEFAULT_PROFILES: Dict[str, Dict[str, Any]] = {
    "ollama_local": {
        "id": "ollama_local",
        "name": "Ollama Local - llama3.2",
        "provider_type": "ollama_local",
        "base_url": "http://localhost:11434/v1",
        "model": "llama3.2",
    },
    "ollama_cloud": {
        "id": "ollama_cloud",
        "name": "Ollama Cloud - llama3.2",
        "provider_type": "ollama_cloud",
        "base_url": "https://ollama.com/v1",
        "api_key_env": "OLLAMA_API_KEY",
        "model": "llama3.2",
    },
    "openai_compat": {
        "id": "openai_compat",
        "name": "Groq - llama-3.3-70b",
        "provider_type": "openai_compat",
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        "model": "llama-3.3-70b-versatile",
    },
}

DEFAULT_APP_CONFIG: Dict[str, Any] = {
    "active_profile": "ollama_local",
    "provider": "ollama_local",
    "profiles": DEFAULT_PROFILES.copy(),
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

    config = DEFAULT_APP_CONFIG.copy()
    config["profiles"] = {k: v.copy() for k, v in DEFAULT_PROFILES.items()}

    if target and target.exists():
        try:
            with open(target, "r", encoding="utf-8") as f:
                loaded = yaml.safe_load(f)
                if isinstance(loaded, dict):
                    # Merge top-level keys
                    config.update(loaded)

                    # Ensure profiles dict exists and is populated
                    if "profiles" not in loaded or not loaded["profiles"]:
                        # Synthesize profiles from legacy providers if present
                        profiles = {}
                        providers_dict = loaded.get("providers", DEFAULT_APP_CONFIG["providers"])
                        for p_key, p_data in providers_dict.items():
                            p_type = p_key if p_key in ("ollama_local", "ollama_cloud") else "openai_compat"
                            name_map = {
                                "ollama_local": "Ollama Local",
                                "ollama_cloud": "Ollama Cloud",
                                "openai_compat": "OpenAI-Compatible",
                            }
                            model_str = p_data.get("model", "")
                            display_name = f"{name_map.get(p_key, p_key.capitalize())} - {model_str}" if model_str else name_map.get(p_key, p_key)
                            profiles[p_key] = {
                                "id": p_key,
                                "name": display_name,
                                "provider_type": p_type,
                                "base_url": p_data.get("base_url", ""),
                                "model": model_str,
                                "api_key": p_data.get("api_key"),
                                "api_key_env": p_data.get("api_key_env"),
                            }
                        config["profiles"] = profiles

                    # Sync active_profile and legacy provider
                    if "active_profile" not in loaded:
                        config["active_profile"] = loaded.get("provider", "ollama_local")
                    if "provider" not in loaded:
                        config["provider"] = config.get("active_profile", "ollama_local")

                    return config
        except Exception:
            pass

    return config


def get_llm_provider(
    config_path: Optional[Path] = None,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
    profile_id: Optional[str] = None,
):
    """
    Factory function returning the configured LLMProvider instance.
    Supports switching providers via named profiles, config.yaml or overrides.
    """
    # Import locally to avoid circular imports
    from clipzilla.llm.providers import (
        OllamaLocalProvider,
        OllamaCloudProvider,
        OpenAICompatProvider,
    )

    config = load_config(config_path)
    profiles = config.get("profiles", {})

    # 1. If profile_id specified or found in profiles
    target_profile_id = profile_id or (provider_override if provider_override in profiles else None) or config.get("active_profile")
    selected_profile = profiles.get(target_profile_id) if target_profile_id else None

    if selected_profile:
        provider_type = selected_profile.get("provider_type", "openai_compat")
        base_url = selected_profile.get("base_url")
        model = model_override or selected_profile.get("model", "llama3.2")
        api_key = selected_profile.get("api_key")

        api_key_env = selected_profile.get("api_key_env")
        if not api_key and api_key_env:
            api_key = os.environ.get(api_key_env)
        if not api_key:
            profile_env_var = f"PROFILE_{selected_profile.get('id', '').upper().replace('-', '_')}_KEY"
            api_key = os.environ.get(profile_env_var)

        if provider_type == "ollama_local":
            return OllamaLocalProvider(
                base_url=base_url or "http://localhost:11434/v1",
                default_model=model,
            )
        elif provider_type == "ollama_cloud":
            return OllamaCloudProvider(
                base_url=base_url or "https://ollama.com/v1",
                api_key=api_key,
                default_model=model,
            )
        else:
            return OpenAICompatProvider(
                base_url=base_url or "https://api.groq.com/openai/v1",
                api_key=api_key,
                default_model=model,
            )

    # 2. Fallback to legacy provider name
    active_provider_name = provider_override or config.get("provider", "ollama_local")
    providers_config = config.get("providers", {})
    provider_settings = providers_config.get(active_provider_name, {})

    base_url = provider_settings.get("base_url")
    model = model_override or provider_settings.get("model", "llama3.2")
    api_key = provider_settings.get("api_key")

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
        return OpenAICompatProvider(
            base_url=base_url or "http://localhost:11434/v1",
            api_key=api_key,
            default_model=model,
        )

from pathlib import Path
import os
import yaml
from typing import Dict, Any, Optional
from dotenv import load_dotenv, set_key

from clipzilla.config import DEFAULT_CONFIG_PATH, load_config

ENV_PATH = Path(".env")
load_dotenv(dotenv_path=ENV_PATH)


def get_safe_settings() -> Dict[str, Any]:
    """
    Returns LLM settings with masked API keys.
    Indicates whether each provider's API key is set without exposing the secret.
    """
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    config = load_config()

    active_provider = config.get("provider", "ollama_local")
    providers_raw = config.get("providers", {})

    safe_providers = {}
    for p_name, p_data in providers_raw.items():
        base_url = p_data.get("base_url", "")
        model = p_data.get("model", "")
        api_key_env = p_data.get("api_key_env")

        has_key = False
        requires_key = p_name in ("ollama_cloud", "openai_compat")

        if api_key_env and os.environ.get(api_key_env):
            has_key = True
        elif p_data.get("api_key"):
            has_key = True

        safe_providers[p_name] = {
            "base_url": base_url,
            "model": model,
            "api_key_env": api_key_env,
            "requires_api_key": requires_key,
            "has_api_key": has_key,
        }

    return {
        "provider": active_provider,
        "providers": safe_providers,
    }


def update_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates config.yaml and saves any provided API keys to the local .env file.
    """
    config = load_config()

    # 1. Update active provider
    if "provider" in payload and payload["provider"]:
        config["provider"] = payload["provider"]

    # 2. Update specific provider settings
    incoming_providers = payload.get("providers", {})
    for p_name, p_data in incoming_providers.items():
        if p_name not in config.setdefault("providers", {}):
            config["providers"][p_name] = {}

        if "base_url" in p_data and p_data["base_url"]:
            config["providers"][p_name]["base_url"] = p_data["base_url"].strip()

        if "model" in p_data and p_data["model"]:
            config["providers"][p_name]["model"] = p_data["model"].strip()

        # Handle API key storage in .env
        api_key = p_data.get("api_key")
        if api_key and api_key.strip():
            api_key = api_key.strip()
            # Determine env variable name
            env_var = p_data.get("api_key_env") or config["providers"][p_name].get("api_key_env")
            if not env_var:
                if p_name == "ollama_cloud":
                    env_var = "OLLAMA_API_KEY"
                else:
                    env_var = "OPENAI_API_KEY"
                config["providers"][p_name]["api_key_env"] = env_var

            # Write to .env
            if not ENV_PATH.exists():
                ENV_PATH.touch()
            set_key(str(ENV_PATH), env_var, api_key)
            os.environ[env_var] = api_key

    # 3. Write back to config.yaml
    with open(DEFAULT_CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(config, f, sort_keys=False)

    return get_safe_settings()

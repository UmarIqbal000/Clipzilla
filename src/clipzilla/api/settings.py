from pathlib import Path
import os
import uuid
import re
import yaml
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv, set_key

from clipzilla.config import DEFAULT_CONFIG_PATH, load_config

ENV_PATH = Path(".env")
load_dotenv(dotenv_path=ENV_PATH)


def get_config_path() -> Path:
    env_path = os.environ.get("CLIPZILLA_CONFIG")
    if env_path:
        return Path(env_path)
    return DEFAULT_CONFIG_PATH


def slugify_id(name: str) -> str:
    """Generates a clean profile ID from name."""
    s = re.sub(r"[^\w\s-]", "", name).strip().lower()
    slug = re.sub(r"[-\s]+", "_", s)
    return slug or f"profile_{uuid.uuid4().hex[:6]}"


def get_safe_profiles() -> Dict[str, Any]:
    """
    Returns list of configured provider profiles with masked API key indicators.
    """
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    config = load_config()

    active_profile_id = config.get("active_profile") or config.get("provider", "ollama_local")
    profiles_dict = config.get("profiles", {})

    safe_list = []
    for p_id, p_data in profiles_dict.items():
        provider_type = p_data.get("provider_type", "openai_compat")
        requires_key = provider_type in ("ollama_cloud", "openai_compat")

        has_key = False
        api_key_env = p_data.get("api_key_env")
        if api_key_env and os.environ.get(api_key_env):
            has_key = True
        elif os.environ.get(f"PROFILE_{p_id.upper().replace('-', '_')}_KEY"):
            has_key = True
        elif p_data.get("api_key"):
            has_key = True

        safe_list.append({
            "id": p_id,
            "name": p_data.get("name", p_id),
            "provider_type": provider_type,
            "base_url": p_data.get("base_url", ""),
            "model": p_data.get("model", ""),
            "requires_api_key": requires_key,
            "has_api_key": has_key,
            "is_active": p_id == active_profile_id,
        })

    return {
        "active_profile": active_profile_id,
        "profiles": safe_list,
    }


def save_profile(profile_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates or updates a named provider profile in config.yaml and saves any API key in .env.
    """
    config = load_config()
    profiles = config.setdefault("profiles", {})

    p_id = profile_data.get("id")
    name = profile_data.get("name", "").strip()
    if not name and not p_id:
        raise ValueError("Profile name is required.")

    if not p_id:
        base_slug = slugify_id(name)
        p_id = base_slug
        # Ensure unique ID
        counter = 1
        while p_id in profiles:
            p_id = f"{base_slug}_{counter}"
            counter += 1

    provider_type = profile_data.get("provider_type", "openai_compat").strip()
    base_url = profile_data.get("base_url", "").strip()
    model = profile_data.get("model", "").strip()

    existing = profiles.get(p_id, {})
    profile_entry = {
        "id": p_id,
        "name": name or existing.get("name", p_id),
        "provider_type": provider_type or existing.get("provider_type", "openai_compat"),
        "base_url": base_url or existing.get("base_url", ""),
        "model": model or existing.get("model", ""),
    }

    # Handle API key storage in .env
    api_key = profile_data.get("api_key")
    if api_key and str(api_key).strip():
        api_key_str = str(api_key).strip()
        env_var = f"PROFILE_{p_id.upper().replace('-', '_')}_KEY"
        profile_entry["api_key_env"] = env_var

        if not ENV_PATH.exists():
            ENV_PATH.touch()
        set_key(str(ENV_PATH), env_var, api_key_str)
        os.environ[env_var] = api_key_str
    elif "api_key_env" in existing:
        profile_entry["api_key_env"] = existing["api_key_env"]

    profiles[p_id] = profile_entry
    config["profiles"] = profiles

    # If this is the only profile, or if requested, set as active
    if len(profiles) == 1 or profile_data.get("is_active"):
        config["active_profile"] = p_id
        config["provider"] = p_id

    # Write back to config.yaml
    with open(get_config_path(), "w", encoding="utf-8") as f:
        yaml.safe_dump(config, f, sort_keys=False)

    return get_safe_profiles()


def delete_profile(profile_id: str) -> Dict[str, Any]:
    """Deletes a profile by ID."""
    config = load_config()
    profiles = config.get("profiles", {})

    if profile_id not in profiles:
        raise ValueError(f"Profile '{profile_id}' not found.")

    if len(profiles) <= 1:
        raise ValueError("Cannot delete the only remaining profile.")

    del profiles[profile_id]
    config["profiles"] = profiles

    if config.get("active_profile") == profile_id:
        remaining_id = next(iter(profiles.keys()))
        config["active_profile"] = remaining_id
        config["provider"] = remaining_id

    with open(get_config_path(), "w", encoding="utf-8") as f:
        yaml.safe_dump(config, f, sort_keys=False)

    return get_safe_profiles()


def set_active_profile(profile_id: str) -> Dict[str, Any]:
    """Sets the active default profile."""
    config = load_config()
    profiles = config.get("profiles", {})

    if profile_id not in profiles:
        raise ValueError(f"Profile '{profile_id}' not found.")

    config["active_profile"] = profile_id
    config["provider"] = profile_id

    with open(get_config_path(), "w", encoding="utf-8") as f:
        yaml.safe_dump(config, f, sort_keys=False)

    return get_safe_profiles()


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

    profile_info = get_safe_profiles()

    return {
        "provider": active_provider,
        "providers": safe_providers,
        "active_profile": profile_info["active_profile"],
        "profiles": profile_info["profiles"],
    }


def update_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates config.yaml and saves any provided API keys to the local .env file.
    """
    config = load_config()

    # 1. Update active provider / active profile
    if "active_profile" in payload and payload["active_profile"]:
        config["active_profile"] = payload["active_profile"]
        config["provider"] = payload["active_profile"]
    elif "provider" in payload and payload["provider"]:
        config["provider"] = payload["provider"]
        config["active_profile"] = payload["provider"]

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
    with open(get_config_path(), "w", encoding="utf-8") as f:
        yaml.safe_dump(config, f, sort_keys=False)

    return get_safe_settings()

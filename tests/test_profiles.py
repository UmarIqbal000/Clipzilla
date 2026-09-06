import unittest
import os
import tempfile
from pathlib import Path
import yaml

from clipzilla.config import load_config, get_llm_provider, DEFAULT_APP_CONFIG
from clipzilla.api.settings import (
    get_safe_profiles,
    save_profile,
    delete_profile,
    set_active_profile,
)
from clipzilla.llm.providers import OllamaLocalProvider, OpenAICompatProvider


class TestProfiles(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_path = Path(self.temp_dir.name) / "config.yaml"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_default_profiles_loaded(self):
        """Tests that default named profiles exist in configuration."""
        config = load_config(config_path=self.config_path)
        self.assertIn("profiles", config)
        self.assertIn("ollama_local", config["profiles"])
        self.assertIn("openai_compat", config["profiles"])
        self.assertEqual(config["active_profile"], "ollama_local")

    def test_legacy_providers_migrated_to_profiles(self):
        """Tests that a legacy config.yaml with only 'providers' is automatically migrated to profiles."""
        legacy_data = {
            "provider": "openai_compat",
            "providers": {
                "custom_provider": {
                    "base_url": "https://api.custom.com/v1",
                    "model": "custom-model-1",
                    "api_key_env": "CUSTOM_KEY",
                }
            },
        }
        with open(self.config_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(legacy_data, f)

        config = load_config(config_path=self.config_path)
        self.assertIn("custom_provider", config["profiles"])
        self.assertEqual(config["profiles"]["custom_provider"]["model"], "custom-model-1")

    def test_get_llm_provider_by_profile_id(self):
        """Tests that get_llm_provider instantiates the correct provider for a requested profile_id."""
        config_data = {
            "active_profile": "ollama_local",
            "profiles": {
                "ollama_local": {
                    "id": "ollama_local",
                    "name": "Ollama Local",
                    "provider_type": "ollama_local",
                    "base_url": "http://localhost:11434/v1",
                    "model": "llama3.2",
                },
                "groq_fast": {
                    "id": "groq_fast",
                    "name": "Groq Fast",
                    "provider_type": "openai_compat",
                    "base_url": "https://api.groq.com/openai/v1",
                    "model": "llama-3.3-70b-versatile",
                },
            },
        }
        with open(self.config_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(config_data, f)

        # Retrieve default profile (ollama_local)
        default_p = get_llm_provider(config_path=self.config_path)
        self.assertIsInstance(default_p, OllamaLocalProvider)

        # Retrieve explicit profile_id (groq_fast)
        groq_p = get_llm_provider(config_path=self.config_path, profile_id="groq_fast")
        self.assertIsInstance(groq_p, OpenAICompatProvider)
        self.assertEqual(groq_p.default_model, "llama-3.3-70b-versatile")

    def test_profile_crud_operations(self):
        """Tests saving, retrieving, switching, and deleting profiles."""
        orig_config_path = os.environ.get("CLIPZILLA_CONFIG")
        try:
            os.environ["CLIPZILLA_CONFIG"] = str(self.config_path)

            # 1. Save new profile
            new_profile = {
                "name": "Test Kimi",
                "provider_type": "ollama_cloud",
                "base_url": "https://ollama.com/v1",
                "model": "kimi-k2.6",
                "api_key": "test_key_123",
            }
            res = save_profile(new_profile)
            self.assertTrue(any(p["name"] == "Test Kimi" for p in res["profiles"]))
            kimi_p = next(p for p in res["profiles"] if p["name"] == "Test Kimi")
            self.assertTrue(kimi_p["has_api_key"])
            self.assertNotIn("test_key_123", str(res))  # Never leak raw key

            # 2. Set active profile
            res = set_active_profile(kimi_p["id"])
            self.assertEqual(res["active_profile"], kimi_p["id"])

            # 3. Delete profile
            # First create a second profile so we can delete the first
            save_profile({
                "name": "Second Profile",
                "provider_type": "ollama_local",
                "base_url": "http://localhost:11434/v1",
                "model": "qwen2.5",
            })
            res = delete_profile(kimi_p["id"])
            self.assertFalse(any(p["id"] == kimi_p["id"] for p in res["profiles"]))

        finally:
            if orig_config_path:
                os.environ["CLIPZILLA_CONFIG"] = orig_config_path
            else:
                os.environ.pop("CLIPZILLA_CONFIG", None)


if __name__ == "__main__":
    unittest.main()

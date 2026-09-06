import unittest
import tempfile
from pathlib import Path
import os
import yaml

from clipzilla.config import load_config, get_llm_provider
from clipzilla.llm.providers import OllamaLocalProvider, OllamaCloudProvider, OpenAICompatProvider


class TestConfig(unittest.TestCase):
    def test_default_config(self):
        config = load_config(Path("non_existent_config.yaml"))
        self.assertEqual(config.get("provider"), "ollama_local")
        self.assertIn("ollama_local", config.get("providers", {}))

    def test_custom_yaml_config(self):
        custom_yaml = """
provider: openai_compat
providers:
  openai_compat:
    base_url: "https://api.groq.com/openai/v1"
    model: "llama-3.3-70b-versatile"
    api_key: "direct_groq_key"
"""
        with tempfile.TemporaryDirectory() as tmpdir:
            cfg_path = Path(tmpdir) / "config.yaml"
            cfg_path.write_text(custom_yaml, encoding="utf-8")

            config = load_config(cfg_path)
            self.assertEqual(config.get("provider"), "openai_compat")

            provider = get_llm_provider(config_path=cfg_path)
            self.assertIsInstance(provider, OpenAICompatProvider)
            self.assertEqual(provider.base_url, "https://api.groq.com/openai/v1")
            self.assertEqual(provider.default_model, "llama-3.3-70b-versatile")
            self.assertEqual(provider.api_key, "direct_groq_key")

    def test_provider_override(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            cfg_path = Path(tmpdir) / "config.yaml"
            cfg_path.write_text("provider: ollama_local\n", encoding="utf-8")

            # Override with openai_compat
            provider = get_llm_provider(
                config_path=cfg_path,
                provider_override="openai_compat",
                model_override="custom-model",
            )
            self.assertIsInstance(provider, OpenAICompatProvider)
            self.assertEqual(provider.default_model, "custom-model")


if __name__ == "__main__":
    unittest.main()

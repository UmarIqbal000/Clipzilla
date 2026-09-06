import unittest
import os
import json
import httpx

from clipzilla.llm.base import (
    LLMError,
    LLMAuthError,
    LLMConnectionError,
    LLMResponseError,
)
from clipzilla.llm.providers import (
    OpenAICompatProvider,
    OllamaLocalProvider,
    OllamaCloudProvider,
)


class TestLLMProviders(unittest.TestCase):
    def test_openai_compat_success(self):
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.url.path, "/v1/chat/completions")
            self.assertEqual(request.headers.get("Authorization"), "Bearer test_key")
            body = json.loads(request.content)
            self.assertEqual(body["model"], "gpt-4o")
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {"message": {"content": "Hello from mock LLM!"}}
                    ]
                },
            )

        client = httpx.Client(transport=httpx.MockTransport(handler))
        provider = OpenAICompatProvider(
            base_url="https://api.openai.com/v1",
            api_key="test_key",
            default_model="gpt-4o",
            client=client,
        )
        response = provider.chat([{"role": "user", "content": "Hi"}])
        self.assertEqual(response, "Hello from mock LLM!")

    def test_ollama_local_defaults(self):
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(str(request.url), "http://localhost:11434/v1/chat/completions")
            self.assertIsNone(request.headers.get("Authorization"))
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {"message": {"content": "Hello from Ollama local"}}
                    ]
                },
            )

        client = httpx.Client(transport=httpx.MockTransport(handler))
        provider = OllamaLocalProvider(client=client)
        self.assertEqual(provider.base_url, "http://localhost:11434/v1")
        response = provider.chat([{"role": "user", "content": "Hi"}])
        self.assertEqual(response, "Hello from Ollama local")

    def test_ollama_cloud_missing_key(self):
        old_key = os.environ.pop("OLLAMA_API_KEY", None)
        try:
            with self.assertRaises(LLMAuthError) as ctx:
                OllamaCloudProvider(api_key=None)
            self.assertIn("OLLAMA_API_KEY", str(ctx.exception))
        finally:
            if old_key is not None:
                os.environ["OLLAMA_API_KEY"] = old_key

    def test_ollama_cloud_with_key(self):
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.headers.get("Authorization"), "Bearer my_cloud_key")
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {"message": {"content": "Hello from Ollama cloud"}}
                    ]
                },
            )

        client = httpx.Client(transport=httpx.MockTransport(handler))
        provider = OllamaCloudProvider(api_key="my_cloud_key", client=client)
        response = provider.chat([{"role": "user", "content": "Hi"}])
        self.assertEqual(response, "Hello from Ollama cloud")

    def test_auth_error_status_code(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, text="Unauthorized: Invalid API key")

        client = httpx.Client(transport=httpx.MockTransport(handler))
        provider = OpenAICompatProvider(
            base_url="https://api.example.com/v1",
            api_key="bad_key",
            client=client,
        )
        with self.assertRaises(LLMAuthError):
            provider.chat([{"role": "user", "content": "Hi"}])

    def test_server_error_status_code(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, text="Internal server error")

        client = httpx.Client(transport=httpx.MockTransport(handler))
        provider = OpenAICompatProvider(
            base_url="https://api.example.com/v1",
            client=client,
        )
        with self.assertRaises(LLMResponseError):
            provider.chat([{"role": "user", "content": "Hi"}])


if __name__ == "__main__":
    unittest.main()

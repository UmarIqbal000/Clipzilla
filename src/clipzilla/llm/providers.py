import os
import logging
from typing import List, Dict, Any, Optional
import httpx

from clipzilla.llm.base import (
    LLMProvider,
    LLMError,
    LLMAuthError,
    LLMConnectionError,
    LLMResponseError,
)

logger = logging.getLogger("clipzilla.llm")


class OpenAICompatProvider(LLMProvider):
    """
    Generic OpenAI-compatible provider.
    Works with any endpoint implementing /v1/chat/completions (Groq, OpenRouter, LM Studio, vLLM, etc.).
    """

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        default_model: str = "llama3.2",
        timeout: float = 120.0,
        client: Optional[httpx.Client] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.default_model = default_model
        self.timeout = timeout
        self._client = client

    def _get_client(self) -> httpx.Client:
        if self._client is not None:
            return self._client
        return httpx.Client(timeout=self.timeout)

    def chat(self, messages: List[Dict[str, str]], model: Optional[str] = None) -> str:
        url = f"{self.base_url}/chat/completions"
        target_model = model or self.default_model

        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": 0.2,
        }

        logger.debug(f"Sending request to {url} (model={target_model})...")

        client = self._get_client()
        # If using internal client, manage lifecycle or use client context
        should_close = self._client is None

        try:
            resp = client.post(url, json=payload, headers=headers)
        except httpx.ConnectError as e:
            raise LLMConnectionError(
                f"Could not connect to LLM endpoint at {self.base_url}. "
                "Ensure your local LLM server (e.g. Ollama) is running or check the base_url."
            ) from e
        except httpx.TimeoutException as e:
            raise LLMConnectionError(
                f"LLM request timed out after {self.timeout}s when connecting to {self.base_url}."
            ) from e
        except httpx.RequestError as e:
            raise LLMConnectionError(f"HTTP request to {self.base_url} failed: {e}") from e
        finally:
            if should_close:
                client.close()

        if resp.status_code in (401, 403):
            raise LLMAuthError(
                f"Authentication failed for {self.base_url} (HTTP {resp.status_code}): {resp.text}"
            )
        elif resp.status_code != 200:
            raise LLMResponseError(
                f"LLM provider returned HTTP {resp.status_code}: {resp.text}"
            )

        try:
            data = resp.json()
            choices = data.get("choices", [])
            if not choices:
                raise LLMResponseError(f"No choices returned in LLM response: {data}")
            content = choices[0].get("message", {}).get("content")
            if content is None:
                raise LLMResponseError(f"Missing message content in choice: {choices[0]}")
            return content
        except Exception as e:
            if isinstance(e, LLMError):
                raise
            raise LLMResponseError(f"Failed to parse LLM JSON response: {e}") from e


class OllamaLocalProvider(OpenAICompatProvider):
    """
    Ollama running locally on http://localhost:11434/v1.
    Requires no API key.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434/v1",
        default_model: str = "llama3.2",
        timeout: float = 120.0,
        client: Optional[httpx.Client] = None,
    ):
        super().__init__(
            base_url=base_url,
            api_key=None,
            default_model=default_model,
            timeout=timeout,
            client=client,
        )


class OllamaCloudProvider(OpenAICompatProvider):
    """
    Ollama Cloud provider hosted at https://ollama.com/v1.
    Requires OLLAMA_API_KEY environment variable.
    """

    def __init__(
        self,
        base_url: str = "https://ollama.com/v1",
        api_key: Optional[str] = None,
        default_model: str = "llama3.2",
        timeout: float = 120.0,
        client: Optional[httpx.Client] = None,
    ):
        resolved_key = api_key or os.environ.get("OLLAMA_API_KEY")
        if not resolved_key:
            raise LLMAuthError(
                "OLLAMA_API_KEY environment variable (or api_key parameter) is required "
                "to use OllamaCloudProvider."
            )
        super().__init__(
            base_url=base_url,
            api_key=resolved_key,
            default_model=default_model,
            timeout=timeout,
            client=client,
        )

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class LLMError(Exception):
    """Base exception for all LLM errors."""
    pass


class LLMAuthError(LLMError):
    """Raised when authentication fails (missing or invalid API key)."""
    pass


class LLMConnectionError(LLMError):
    """Raised when connection to LLM provider fails or times out."""
    pass


class LLMResponseError(LLMError):
    """Raised when LLM returns an unexpected status code or response format."""
    pass


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    def chat(self, messages: List[Dict[str, str]], model: Optional[str] = None) -> str:
        """
        Sends a list of chat messages to the LLM and returns the assistant's text response.

        Args:
            messages: List of message dictionaries, e.g. [{"role": "user", "content": "..."}]
            model: Optional model name override. If None, uses provider default.

        Returns:
            str: Assistant response text.
        """
        pass

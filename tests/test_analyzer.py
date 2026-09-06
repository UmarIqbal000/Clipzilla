import unittest
import json
from clipzilla.llm.base import LLMProvider
from clipzilla.analyzer import (
    extract_json_from_text,
    analyze_transcript,
    format_transcript_for_llm,
)


class MockFlakyLLMProvider(LLMProvider):
    """Mocks an LLM that fails on attempt 1 with malformed JSON, and succeeds on attempt 2."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.call_count = 0
        self.received_messages = []

    def chat(self, messages, model=None):
        self.call_count += 1
        self.received_messages.append(messages)
        if self.responses:
            return self.responses.pop(0)
        return "{}"


class TestAnalyzer(unittest.TestCase):
    def setUp(self):
        self.sample_transcript = {
            "video_id": "test_vid",
            "segments": [
                {
                    "id": 0,
                    "start": 0.0,
                    "end": 10.0,
                    "text": "Welcome to this amazing python tutorial.",
                    "words": [
                        {"word": "Welcome", "start": 0.0, "end": 1.0},
                        {"word": "to", "start": 1.0, "end": 2.0},
                        {"word": "this", "start": 2.0, "end": 3.0},
                        {"word": "amazing", "start": 3.0, "end": 5.0},
                        {"word": "python", "start": 5.0, "end": 7.0},
                        {"word": "tutorial.", "start": 7.0, "end": 10.0},
                    ],
                },
                {
                    "id": 1,
                    "start": 10.0,
                    "end": 30.0,
                    "text": "Here is the secret trick you need to know.",
                    "words": [
                        {"word": "Here", "start": 10.0, "end": 12.0},
                        {"word": "is", "start": 12.0, "end": 14.0},
                        {"word": "the", "start": 14.0, "end": 16.0},
                        {"word": "secret", "start": 16.0, "end": 20.0},
                        {"word": "trick", "start": 20.0, "end": 23.0},
                        {"word": "you", "start": 23.0, "end": 25.0},
                        {"word": "need", "start": 25.0, "end": 27.0},
                        {"word": "to", "start": 27.0, "end": 28.0},
                        {"word": "know.", "start": 28.0, "end": 30.0},
                    ],
                },
            ],
        }

    def test_extract_json_markdown_blocks(self):
        raw = """Here are the clips you requested:
```json
{
  "clips": [
    {
      "start_time": 5.0,
      "end_time": 20.0,
      "title": "Amazing Secret",
      "reason": "Strong hook right at the beginning"
    }
  ]
}
```
Hope this helps!"""
        parsed = extract_json_from_text(raw)
        self.assertIn("clips", parsed)
        self.assertEqual(len(parsed["clips"]), 1)
        self.assertEqual(parsed["clips"][0]["title"], "Amazing Secret")

    def test_retry_on_malformed_json(self):
        # Attempt 1: Invalid JSON (missing closing brace)
        # Attempt 2: Valid JSON
        responses = [
            '{"clips": [{"start_time": 0.0, "end_time": 10.0, "title": "Incomplete"',
            json.dumps({
                "clips": [
                    {
                        "start_time": 0.0,
                        "end_time": 10.0,
                        "title": "Welcome Clip",
                        "reason": "Clear introduction with direct hook",
                    }
                ]
            }),
        ]
        provider = MockFlakyLLMProvider(responses)
        clips = analyze_transcript(self.sample_transcript, provider=provider, max_retries=2)

        self.assertEqual(provider.call_count, 2)
        self.assertEqual(len(clips), 1)
        self.assertEqual(clips[0].title, "Welcome Clip")
        # Ensure error correction prompt was passed to attempt 2
        last_messages = provider.received_messages[-1]
        self.assertTrue(any("validation errors" in m["content"] for m in last_messages))

    def test_retry_on_out_of_bounds_timestamps(self):
        # Attempt 1: Timestamp 999.0s exceeds video duration (30.0s)
        # Attempt 2: Valid timestamps
        responses = [
            json.dumps({
                "clips": [
                    {
                        "start_time": 500.0,
                        "end_time": 999.0,
                        "title": "Out of bounds",
                        "reason": "Exceeds video length",
                    }
                ]
            }),
            json.dumps({
                "clips": [
                    {
                        "start_time": 10.0,
                        "end_time": 30.0,
                        "title": "Secret Trick",
                        "reason": "Complete actionable advice",
                    }
                ]
            }),
        ]
        provider = MockFlakyLLMProvider(responses)
        clips = analyze_transcript(self.sample_transcript, provider=provider, max_retries=2)

        self.assertEqual(provider.call_count, 2)
        self.assertEqual(len(clips), 1)
        self.assertEqual(clips[0].title, "Secret Trick")


if __name__ == "__main__":
    unittest.main()

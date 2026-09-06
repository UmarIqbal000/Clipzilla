import unittest
from click.testing import CliRunner
from clipzilla.cli import main


class TestCliCommands(unittest.TestCase):
    def setUp(self):
        self.runner = CliRunner()

    def test_help(self):
        result = self.runner.invoke(main, ["--help"])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Clipzilla", result.output)
        self.assertIn("download", result.output)
        self.assertIn("transcribe", result.output)
        self.assertIn("clip", result.output)

    def test_download_help(self):
        result = self.runner.invoke(main, ["download", "--help"])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("--workdir", result.output)

    def test_transcribe_help(self):
        result = self.runner.invoke(main, ["transcribe", "--help"])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("--force-whisper", result.output)
        self.assertIn("--model", result.output)

    def test_clip_help(self):
        result = self.runner.invoke(main, ["clip", "--help"])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("--start", result.output)
        self.assertIn("--end", result.output)
        self.assertIn("--no-subtitles", result.output)

    def test_analyze_help(self):
        result = self.runner.invoke(main, ["analyze", "--help"])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("--provider", result.output)
        self.assertIn("--model", result.output)
        self.assertIn("--config", result.output)
        self.assertIn("--workdir", result.output)

    def test_analyze_execution_with_mock(self):
        import tempfile
        from pathlib import Path
        import json
        from unittest.mock import patch

        with tempfile.TemporaryDirectory() as tmpdir:
            workdir = Path(tmpdir)
            video_dir = workdir / "vid123"
            video_dir.mkdir()

            transcript_data = {
                "video_id": "vid123",
                "segments": [
                    {
                        "id": 0,
                        "start": 0.0,
                        "end": 20.0,
                        "text": "Hello world from Clipzilla. Learn how to write python.",
                        "words": [
                            {"word": "Hello", "start": 0.0, "end": 0.5},
                            {"word": "world", "start": 0.5, "end": 1.0},
                            {"word": "from", "start": 1.0, "end": 1.5},
                            {"word": "Clipzilla.", "start": 1.5, "end": 2.5},
                            {"word": "Learn", "start": 3.0, "end": 3.5},
                            {"word": "how", "start": 3.5, "end": 4.0},
                            {"word": "to", "start": 4.0, "end": 4.5},
                            {"word": "write", "start": 4.5, "end": 5.0},
                            {"word": "python.", "start": 5.0, "end": 6.0},
                        ],
                    }
                ],
            }
            (video_dir / "transcript.json").write_text(json.dumps(transcript_data), encoding="utf-8")

            mock_response = json.dumps({
                "clips": [
                    {
                        "start_time": 0.0,
                        "end_time": 6.0,
                        "title": "Learn Python Quick",
                        "reason": "Direct opening hook with full explanation",
                    }
                ]
            })

            with patch("clipzilla.llm.providers.OpenAICompatProvider.chat", return_value=mock_response):
                result = self.runner.invoke(main, [
                    "analyze",
                    "vid123",
                    "--workdir", str(workdir),
                    "--provider", "ollama_local",
                ])
                self.assertEqual(result.exit_code, 0, result.output)
                self.assertIn("Identified 1 suggested clips", result.output)
                self.assertIn("Learn Python Quick", result.output)
                self.assertTrue((video_dir / "clips_suggested.json").exists())


if __name__ == "__main__":
    unittest.main()

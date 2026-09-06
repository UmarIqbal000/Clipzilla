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


if __name__ == "__main__":
    unittest.main()

import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import tempfile

from clipzilla.downloader import generate_proxy_video


class TestProxyGeneration(unittest.TestCase):
    def test_proxy_already_exists(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            source = Path(tmpdir) / "source.mp4"
            source.write_bytes(b"dummy source")
            proxy = Path(tmpdir) / "proxy.mp4"
            proxy.write_bytes(b"x" * 2048)

            result = generate_proxy_video(source, proxy)
            self.assertEqual(result, proxy)

    @patch("subprocess.run")
    def test_proxy_command_invocation(self, mock_run):
        with tempfile.TemporaryDirectory() as tmpdir:
            source = Path(tmpdir) / "source.mp4"
            source.write_bytes(b"dummy source")
            proxy = Path(tmpdir) / "proxy.mp4"
            temp_proxy = Path(tmpdir) / "proxy.tmp.mp4"

            def fake_run(cmd, **kwargs):
                temp_proxy.write_bytes(b"generated 480p proxy content")
                return MagicMock(returncode=0)

            mock_run.side_effect = fake_run

            result = generate_proxy_video(source, proxy)
            self.assertEqual(result, proxy)
            self.assertTrue(proxy.exists())

            # Check that ffmpeg was called with scale=-2:480 and +faststart
            called_cmd = mock_run.call_args[0][0]
            self.assertIn("scale=-2:480", called_cmd)
            self.assertIn("+faststart", called_cmd)


if __name__ == "__main__":
    unittest.main()

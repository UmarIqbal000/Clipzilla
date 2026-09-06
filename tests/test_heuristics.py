import unittest
from clipzilla.schema import SuggestedClip
from clipzilla.heuristics import check_clip_boundaries, apply_heuristics_to_clips


class TestHeuristics(unittest.TestCase):
    def setUp(self):
        # A mock list of words representing:
        # "Hello world. This is a great tip! Python devours long form."
        self.words = [
            {"word": "Hello", "start": 0.0, "end": 0.5},
            {"word": "world.", "start": 0.5, "end": 1.0},
            {"word": "This", "start": 1.5, "end": 2.0},  # pause of 0.5s before "This"
            {"word": "is", "start": 2.0, "end": 2.3},
            {"word": "a", "start": 2.3, "end": 2.5},
            {"word": "great", "start": 2.5, "end": 2.9},
            {"word": "tip!", "start": 2.9, "end": 3.5},
            {"word": "Python", "start": 4.0, "end": 4.5},  # pause of 0.5s before "Python"
            {"word": "devours", "start": 4.5, "end": 5.0},
            {"word": "long", "start": 5.0, "end": 5.4},
            {"word": "form.", "start": 5.4, "end": 6.0},
        ]

    def test_clean_boundaries(self):
        # Clip from 1.5s ("This") to 3.5s ("tip!")
        clip = SuggestedClip(
            start_time=1.5,
            end_time=3.5,
            title="Great Tip",
            reason="Clear tip with clean boundaries",
        )
        needs_trimming, notes, _, _ = check_clip_boundaries(clip, self.words)
        self.assertFalse(needs_trimming)
        self.assertIn("Clean", notes)

    def test_mid_sentence_start(self):
        # Clip starts at 2.3s ("a" great tip) -> starts mid-sentence!
        clip = SuggestedClip(
            start_time=2.3,
            end_time=3.5,
            title="Cutoff Start",
            reason="Starts mid-sentence",
        )
        needs_trimming, notes, suggested_start, _ = check_clip_boundaries(clip, self.words)
        self.assertTrue(needs_trimming)
        self.assertIn("Starts mid-sentence", notes)
        self.assertEqual(suggested_start, 1.5)  # Backtracks to "This"

    def test_mid_sentence_end(self):
        # Clip ends at 5.0s ("devours") -> ends mid-sentence!
        clip = SuggestedClip(
            start_time=4.0,
            end_time=5.0,
            title="Cutoff End",
            reason="Ends mid-sentence",
        )
        needs_trimming, notes, _, suggested_end = check_clip_boundaries(clip, self.words)
        self.assertTrue(needs_trimming)
        self.assertIn("Ends mid-sentence", notes)
        self.assertEqual(suggested_end, 6.0)  # Advances to "form."


if __name__ == "__main__":
    unittest.main()

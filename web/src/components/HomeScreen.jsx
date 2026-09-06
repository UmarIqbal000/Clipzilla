import React, { useState } from 'react';
import { Play, Sparkles, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Layers, Film } from 'lucide-react';

export default function HomeScreen({ onStartJob, activeJob, onNavigateToResults }) {
  const [url, setUrl] = useState('');
  const [preset, setPreset] = useState('karaoke');
  const [reframe, setReframe] = useState('auto');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setLocalError('Please enter a YouTube video URL.');
      return;
    }
    setLocalError('');
    setSubmitting(true);
    try {
      await onStartJob({ url: url.trim(), preset, reframe });
    } catch (err) {
      setLocalError(err.message || 'Failed to submit job.');
    } finally {
      setSubmitting(false);
    }
  };

  const isJobActive = activeJob && ['queued', 'downloading', 'transcribing', 'analyzing', 'rendering'].includes(activeJob.status);
  const isJobDone = activeJob && activeJob.status === 'done';
  const isJobFailed = activeJob && activeJob.status === 'failed';

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Local-First AI Shorts Generator</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
          Devour Long-Form. <br />
          <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
            Spit Out Viral Shorts.
          </span>
        </h2>
        <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
          Paste any YouTube URL. Clipzilla downloads, transcribes, finds the highest-retention hooks, reframes with AI speaker tracking, and burns animated subtitles.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur mb-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              YouTube Video URL
            </label>
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={isJobActive || submitting}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-12 text-sm sm:text-base disabled:opacity-50"
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <div className="border-t border-slate-800/80 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Custom Subtitle Preset & Reframing Strategy</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Subtitle Preset
                  </label>
                  <select
                    value={preset}
                    onChange={(e) => setPreset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="karaoke">Karaoke (Line Progressive Highlight)</option>
                    <option value="single">Single Word (Punchy Animated Pop-up)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Reframing Strategy
                  </label>
                  <select
                    value={reframe}
                    onChange={(e) => setReframe(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="auto">Auto (Speaker Face Track + Blur Fallback)</option>
                    <option value="blur">Blurred Background Fill (Screen/Gameplay)</option>
                    <option value="face">Force Speaker Tracking</option>
                    <option value="center">Static Center Crop</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {localError && (
            <div className="flex items-center space-x-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isJobActive || submitting}
            className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Launching Clipzilla...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Generate Shorts</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Live Active Job Progress Card */}
      {activeJob && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              {isJobActive && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
              {isJobDone && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              {isJobFailed && <AlertCircle className="w-4 h-4 text-rose-400" />}
              <span className="text-sm font-semibold text-white capitalize">
                Status: {activeJob.status}
              </span>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
              {activeJob.progress}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden mb-3 border border-slate-800">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isJobFailed
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-emerald-500 to-green-400'
              }`}
              style={{ width: `${Math.max(activeJob.progress, 5)}%` }}
            />
          </div>

          <p className="text-xs sm:text-sm text-slate-400 mb-4">
            {activeJob.stage_message || 'Processing video pipeline...'}
          </p>

          {isJobFailed && activeJob.error_message && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg font-mono mb-4">
              {activeJob.error_message}
            </div>
          )}

          {isJobDone && (
            <button
              onClick={onNavigateToResults}
              className="w-full py-2.5 px-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-sm font-semibold transition-all flex items-center justify-center space-x-2"
            >
              <Film className="w-4 h-4" />
              <span>View Generated Shorts</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

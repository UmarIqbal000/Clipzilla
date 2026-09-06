import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Layers,
  Film,
  Video,
  ListOrdered,
  Cpu,
  Tv,
  Smartphone,
  Share2,
  X,
  Clipboard,
  ExternalLink,
} from 'lucide-react';

const PRESET_OPTIONS = [
  {
    id: 'youtube_shorts',
    name: 'YouTube Shorts',
    duration: 'Up to 3 min',
    bitrate: '10 Mbps',
    icon: Tv,
    desc: 'Vertical 9:16 optimized for YouTube algorithm',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    duration: 'Up to 10 min',
    bitrate: '12 Mbps (High)',
    icon: Smartphone,
    desc: 'High-bitrate 9:16 for crisp mobile playback',
  },
  {
    id: 'instagram_reels',
    name: 'Instagram Reels',
    duration: 'Up to 3 min',
    bitrate: '8 Mbps',
    icon: Share2,
    desc: 'Clean 9:16 encoding for Instagram feeds',
  },
];

export default function HomeScreen({
  onStartJob,
  activeJob,
  onNavigateToResults,
  onDismissJob,
}) {
  const [mode, setMode] = useState('single'); // 'single' or 'batch'
  const [singleUrl, setSingleUrl] = useState('');
  const [batchUrlsText, setBatchUrlsText] = useState('');
  const [exportPreset, setExportPreset] = useState('youtube_shorts');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [availableProfiles, setAvailableProfiles] = useState([]);

  const [preset, setPreset] = useState('karaoke');
  const [reframe, setReframe] = useState('auto');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  // Fetch profiles on mount
  useEffect(() => {
    fetch('/settings/profiles')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.profiles) {
          setAvailableProfiles(data.profiles);
          if (data.active_profile) {
            setSelectedProfileId(data.active_profile);
          } else if (data.profiles.length > 0) {
            setSelectedProfileId(data.profiles[0].id);
          }
        }
      })
      .catch((err) => console.error('Failed to load profiles:', err));
  }, []);

  const parsedBatchUrls = batchUrlsText
    .replace(/,/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (mode === 'single') {
          setSingleUrl(text.trim());
        } else {
          setBatchUrlsText((prev) => (prev ? `${prev}\n${text.trim()}` : text.trim()));
        }
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    let payload = {
      preset,
      reframe,
      export_preset: exportPreset,
      profile_id: selectedProfileId || undefined,
    };

    if (mode === 'single') {
      if (!singleUrl.trim()) {
        setLocalError('Please enter a YouTube video URL.');
        return;
      }
      payload.url = singleUrl.trim();
    } else {
      if (parsedBatchUrls.length === 0) {
        setLocalError('Please enter at least one YouTube URL for batch processing.');
        return;
      }
      payload.urls = parsedBatchUrls;
    }

    setSubmitting(true);
    try {
      await onStartJob(payload);
    } catch (err) {
      setLocalError(err.message || 'Failed to submit job.');
    } finally {
      setSubmitting(false);
    }
  };

  const isJobActive =
    activeJob &&
    ['queued', 'downloading', 'transcribing', 'analyzing', 'rendering'].includes(activeJob.status);
  const isJobDone = activeJob && activeJob.status === 'done';
  const isJobFailed = activeJob && activeJob.status === 'failed';

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Local-First AI Shorts Generator</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
          Devour Long-Form. <br />
          <span className="bg-gradient-to-r from-emerald-400 via-green-300 to-teal-300 bg-clip-text text-transparent">
            Spit Out Viral Shorts.
          </span>
        </h2>
        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
          Convert full YouTube videos into viral short-form clips. AI speaker tracking, automated transcription, hook detection, and animated captions.
        </p>
      </div>

      {/* Main Generator Form Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur mb-8 space-y-7">
        {/* Ingestion Mode Switcher */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Ingestion Mode
            </span>
            <span className="text-[11px] text-slate-400">
              {mode === 'single' ? 'Convert a single YouTube video' : 'Convert multiple YouTube videos sequentially'}
            </span>
          </div>

          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'single'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Single Video</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'batch'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Batch Mode</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input Box */}
          {mode === 'single' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-200">
                  YouTube Video URL
                </label>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 font-medium transition-colors cursor-pointer"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>Paste Link</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="url"
                  required
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-slate-950 border-2 border-slate-700 hover:border-slate-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 transition-all pr-20 text-sm sm:text-base font-medium"
                />
                {singleUrl && (
                  <button
                    type="button"
                    onClick={() => setSingleUrl('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                <span>Supports standard YouTube links, youtu.be, and livestream recordings</span>
                <button
                  type="button"
                  onClick={() => setSingleUrl('https://www.youtube.com/watch?v=x7X9w_GIm1s')}
                  className="text-slate-400 hover:text-emerald-400 underline cursor-pointer"
                >
                  Load sample video
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-200">
                  Batch YouTube URLs (One per line)
                </label>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 font-medium cursor-pointer"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>Paste Links</span>
                  </button>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono font-semibold border border-slate-700">
                    {parsedBatchUrls.length} {parsedBatchUrls.length === 1 ? 'video' : 'videos'} detected
                  </span>
                </div>
              </div>

              <textarea
                rows={4}
                value={batchUrlsText}
                onChange={(e) => setBatchUrlsText(e.target.value)}
                placeholder={'https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=...'}
                className="w-full bg-slate-950 border-2 border-slate-700 hover:border-slate-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 rounded-2xl px-4 py-3 text-white font-mono placeholder-slate-600 transition-all text-xs sm:text-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Paste each YouTube URL on a new line. Videos will be processed sequentially one-by-one.
              </p>
            </div>
          )}

          {/* Export Presets Cards */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
              Export Platform Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = exportPreset === opt.id;
                const IconComponent = opt.icon;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExportPreset(opt.id)}
                    className={`text-left rounded-2xl p-4 border-2 transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 shadow-lg shadow-emerald-500/15 text-white'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold">{opt.name}</span>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-400'
                            : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-medium pt-1">
                      <span className={isSelected ? 'text-emerald-300' : 'text-slate-400'}>
                        {opt.duration}
                      </span>
                      <span className="font-mono text-slate-500 text-[10px]">
                        {opt.bitrate}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Profile Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>AI Provider Profile</span>
            </label>
            <div className="relative">
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full bg-slate-950 border-2 border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none cursor-pointer pr-10"
              >
                {availableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model} &bull; {p.provider_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Advanced Pipeline Settings Accordion */}
          <div className="border-t border-slate-800/80 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer py-1"
            >
              <span className="flex items-center space-x-2">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Advanced: Custom Subtitle Style & Reframing</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-800/50">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Subtitle Preset
                  </label>
                  <select
                    value={preset}
                    onChange={(e) => setPreset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
            <div className="flex items-center space-x-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-500 hover:from-emerald-500 hover:to-green-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 transition-all shadow-xl shadow-emerald-500/25 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2.5 text-base cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Launching Clipzilla Pipeline...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>
                  {mode === 'batch'
                    ? `Queue Batch (${parsedBatchUrls.length || 0} Videos)`
                    : 'Generate Viral Shorts'}
                </span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Live Active Job Card (with Dismiss button) */}
      {activeJob && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur transition-all relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2.5">
              {isJobActive && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
              {isJobDone && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              {isJobFailed && <AlertCircle className="w-4 h-4 text-rose-400" />}
              <span className="text-sm font-bold text-white capitalize">
                Job Status: {activeJob.status}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                {activeJob.progress}%
              </span>
              {onDismissJob && (
                <button
                  type="button"
                  onClick={onDismissJob}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Dismiss this job view"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
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
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl font-mono mb-4">
              {activeJob.error_message}
            </div>
          )}

          <div className="flex items-center space-x-3">
            {isJobDone && (
              <button
                type="button"
                onClick={onNavigateToResults}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                <Film className="w-4 h-4" />
                <span>View Generated Shorts</span>
              </button>
            )}

            {onDismissJob && (
              <button
                type="button"
                onClick={onDismissJob}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Dismiss Status
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

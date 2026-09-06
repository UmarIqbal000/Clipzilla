import React, { useState, useEffect } from 'react';
import {
  Play,
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
} from 'lucide-react';

const PRESET_OPTIONS = [
  {
    id: 'youtube_shorts',
    name: 'YouTube Shorts',
    duration: 'Up to 3 min',
    bitrate: '10 Mbps',
    icon: Tv,
    desc: 'Optimized 9:16 for YouTube Shorts algorithm',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    duration: 'Up to 10 min',
    bitrate: '12 Mbps (High)',
    icon: Smartphone,
    desc: 'High-bitrate 9:16 for maximum mobile clarity',
  },
  {
    id: 'instagram_reels',
    name: 'Instagram Reels',
    duration: 'Up to 3 min',
    bitrate: '8 Mbps',
    icon: Share2,
    desc: 'Clean 9:16 encoding for Instagram compression',
  },
];

export default function HomeScreen({ onStartJob, activeJob, onNavigateToResults }) {
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

  // Fetch profiles on load
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
      .catch((err) => console.error('Failed to load profiles in Home:', err));
  }, []);

  const parsedBatchUrls = batchUrlsText
    .replace(/,/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

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
          Convert full YouTube videos into viral short-form clips. AI speaker tracking, automated transcription, hook detection, and animated captions.
        </p>
      </div>

      {/* Main Generator Form */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur mb-8 space-y-6">
        {/* Ingestion Mode Switcher */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Ingestion Mode
          </span>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'single'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Single Video</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'batch'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Batch Mode</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input Area */}
          {mode === 'single' ? (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                YouTube Video URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={isJobActive || submitting}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all pr-12 text-sm disabled:opacity-50"
                />
                {singleUrl && (
                  <button
                    type="button"
                    onClick={() => setSingleUrl('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">
                  Batch YouTube URLs (One per line)
                </label>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono">
                  {parsedBatchUrls.length} {parsedBatchUrls.length === 1 ? 'video' : 'videos'} detected
                </span>
              </div>
              <textarea
                rows={4}
                value={batchUrlsText}
                onChange={(e) => setBatchUrlsText(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=..."
                disabled={isJobActive || submitting}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-xs disabled:opacity-50"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Videos will be queued and processed sequentially one at a time.
              </p>
            </div>
          )}

          {/* Export Presets Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2.5">
              Export Platform Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = exportPreset === opt.id;
                const IconComponent = opt.icon;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setExportPreset(opt.id)}
                    className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold flex items-center space-x-1.5 ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                        <IconComponent className="w-3.5 h-3.5 shrink-0" />
                        <span>{opt.name}</span>
                      </span>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-emerald-400 bg-emerald-400' : 'border-slate-700'}`}>
                        {isSelected && <div className="w-1 h-1 rounded-full bg-slate-950" />}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{opt.duration}</span>
                      <span className="font-mono text-slate-500 text-[10px]">{opt.bitrate}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Profile Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>AI Provider Profile for this Job</span>
            </label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {availableProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.model} &bull; {p.provider_type})
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Pipeline Settings Toggle */}
          <div className="border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Custom Subtitle Style & Reframing Strategy</span>
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
                <span>
                  {mode === 'batch'
                    ? `Queue Batch (${parsedBatchUrls.length} Videos)`
                    : 'Generate Shorts'}
                </span>
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

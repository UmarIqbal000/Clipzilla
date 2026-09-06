import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
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
  Disc,
} from 'lucide-react';
import { apiGet } from '../api/client';

const PRESET_OPTIONS = [
  {
    id: 'youtube_shorts',
    name: 'YouTube Shorts',
    duration: 'Max 3 min',
    bitrate: '10 Mbps',
    icon: Tv,
    desc: 'Vertical 9:16 optimized for YouTube Shorts shelf',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    duration: 'Max 10 min',
    bitrate: '12 Mbps',
    icon: Smartphone,
    desc: 'High-bitrate 9:16 for high-retention feeds',
  },
  {
    id: 'instagram_reels',
    name: 'Instagram Reels',
    duration: 'Max 3 min',
    bitrate: '8 Mbps',
    icon: Share2,
    desc: 'Clean 9:16 balance for Instagram compression',
  },
];

const PIPELINE_STAGES = [
  { key: 'downloading', label: 'Ingest' },
  { key: 'transcribing', label: 'Transcribe' },
  { key: 'analyzing', label: 'Analyze' },
  { key: 'rendering', label: 'Render' },
];

export default function HomeScreen({
  onStartJob,
  activeJob,
  onNavigateToResults,
  onDismissJob,
}) {
  const [mode, setMode] = useState('single');
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
  const [triggerShutter, setTriggerShutter] = useState(false);

  useEffect(() => {
    apiGet('/settings/profiles')
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
      // Clipboard denied
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
        setLocalError('Please feed a YouTube video URL to the monster.');
        return;
      }
      payload.url = singleUrl.trim();
    } else {
      if (parsedBatchUrls.length === 0) {
        setLocalError('Please feed at least one YouTube URL for batch processing.');
        return;
      }
      payload.urls = parsedBatchUrls;
    }

    setTriggerShutter(true);
    setTimeout(() => setTriggerShutter(false), 500);

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

  const getActiveStageIndex = () => {
    if (!activeJob) return -1;
    if (isJobDone) return 4;
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === activeJob.status);
    return idx !== -1 ? idx : (activeJob.status === 'queued' ? 0 : 0);
  };
  const activeStageIdx = getActiveStageIndex();

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded bg-cz-surface border border-cz-border text-xs font-semibold text-cz-bone mb-4">
          <Disc className="w-3.5 h-3.5 text-cz-ember animate-reel-spin" />
          <span className="tracking-wide uppercase text-[11px]">35mm Celluloid Digestion Engine</span>
        </div>
        
        <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl tracking-wide text-cz-bone uppercase leading-[0.95] mb-3 select-none">
          FEED THE MONSTER.<br />
          <span className="text-cz-ember">DEVOUR VIDEO.</span>
          <br className="block sm:hidden" />{' '}
          <span className="text-cz-ember">SPIT OUT SHORTS.</span>
        </h1>
        
        <p className="text-cz-muted text-sm sm:text-base max-w-xl mx-auto font-sans leading-relaxed">
          Clipzilla chews through long-form YouTube footage, tracks speaker faces with neural vision, and stamps punchy vertical reels with animated captions.
        </p>
      </div>

      {/* Main Devour Console (Tier 1 Hierarchy) */}
      <div
        className={`bg-cz-surface border border-cz-border rounded-lg shadow-2xl relative overflow-hidden mb-8 transition-all ${
          triggerShutter ? 'animate-shutter-snap ring-2 ring-cz-ember' : ''
        }`}
      >
        {/* Top Filmstrip Sprocket Border */}
        <div className="h-2 w-full sprocket-track-h opacity-60 border-b border-cz-border/50" />

        <div className="p-6 sm:p-8 space-y-7">
          {/* Ingestion Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cz-border pb-5">
            <div>
              <span className="text-xs font-bold text-cz-bone uppercase tracking-wider block">
                Ingestion Mode
              </span>
              <span className="text-xs text-cz-muted font-sans">
                {mode === 'single' ? 'Devour one single YouTube video' : 'Devour multiple reels sequentially'}
              </span>
            </div>

            <div className="flex bg-cz-base p-1 rounded border border-cz-border self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'single'
                    ? 'bg-cz-raised text-cz-bone border border-cz-border shadow-sm'
                    : 'text-cz-muted hover:text-cz-bone'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-cz-ember" />
                <span>Single Reel</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('batch')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'batch'
                    ? 'bg-cz-raised text-cz-bone border border-cz-border shadow-sm'
                    : 'text-cz-muted hover:text-cz-bone'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5 text-cz-ember" />
                <span>Batch Spool</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* URL Intake Chamber */}
            {mode === 'single' ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-cz-bone uppercase tracking-wider">
                    YouTube Video URL
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-xs text-cz-ember hover:text-cz-ember-hover flex items-center space-x-1 font-medium cursor-pointer transition-colors"
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
                    className="w-full bg-cz-base border border-cz-border focus:border-cz-ember focus:ring-1 focus:ring-cz-ember rounded-md px-4 py-3 text-cz-bone placeholder:text-cz-muted/50 transition-all pr-20 text-sm font-sans"
                  />
                  {singleUrl && (
                    <button
                      type="button"
                      onClick={() => setSingleUrl('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-cz-raised hover:bg-cz-border text-cz-muted hover:text-cz-bone px-2 py-1 rounded transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-2 gap-1 text-[11px] text-cz-muted">
                  <span>Direct link, youtu.be, or stream archive</span>
                  <button
                    type="button"
                    onClick={() => setSingleUrl('https://www.youtube.com/watch?v=yFvl2x8_9gI')}
                    className="text-cz-muted hover:text-cz-bone underline cursor-pointer text-left sm:text-right"
                  >
                    Load Claude Code Video
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-cz-bone uppercase tracking-wider">
                    Batch YouTube URLs (One per line)
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="text-xs text-cz-ember hover:text-cz-ember-hover flex items-center space-x-1 font-medium cursor-pointer"
                    >
                      <Clipboard className="w-3 h-3" />
                      <span>Paste Links</span>
                    </button>
                    <span className="text-xs px-2 py-0.5 rounded bg-cz-base text-cz-bone font-medium border border-cz-border tabular-nums">
                      {parsedBatchUrls.length} {parsedBatchUrls.length === 1 ? 'reel' : 'reels'} queued
                    </span>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={batchUrlsText}
                  onChange={(e) => setBatchUrlsText(e.target.value)}
                  placeholder={'https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=...'}
                  className="w-full bg-cz-base border border-cz-border focus:border-cz-ember focus:ring-1 focus:ring-cz-ember rounded-md px-4 py-3 text-cz-bone placeholder:text-cz-muted/50 transition-all text-xs sm:text-sm font-sans leading-relaxed"
                />
                <p className="text-[11px] text-cz-muted mt-1.5">
                  Paste each YouTube URL on a new line. The engine processes each video in sequence.
                </p>
              </div>
            )}

            {/* Export Presets Cards */}
            <div>
              <label className="block text-xs font-bold text-cz-bone uppercase tracking-wider mb-2.5">
                Export Reel Format
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PRESET_OPTIONS.map((opt) => {
                  const isSelected = exportPreset === opt.id;
                  const IconComponent = opt.icon;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setExportPreset(opt.id)}
                      className={`text-left rounded-md p-3.5 border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-cz-ember-subtle border-cz-ember shadow-md shadow-cz-ember/10 ring-1 ring-cz-ember text-cz-bone'
                          : 'bg-cz-base border-cz-border hover:border-cz-muted/50 text-cz-bone'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-6 h-6 rounded flex items-center justify-center ${
                              isSelected
                                ? 'bg-cz-ember text-cz-bone'
                                : 'bg-cz-raised text-cz-muted'
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold tracking-wide">{opt.name}</span>
                        </div>

                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-cz-ember bg-cz-ember'
                              : 'border-cz-border'
                          }`}
                        >
                          {isSelected && <div className="w-1 h-1 rounded-full bg-cz-bone" />}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-medium pt-1">
                        <span className={isSelected ? 'text-cz-bone' : 'text-cz-muted'}>
                          {opt.duration}
                        </span>
                        <span className="text-cz-muted text-[10px] tabular-nums">
                          {opt.bitrate}
                        </span>
                      </div>

                      <p className="text-[10px] text-cz-muted mt-1 line-clamp-1">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Profile Selector */}
            <div>
              <label className="block text-xs font-bold text-cz-bone uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-cz-ember" />
                <span>AI Retention Analysis Engine</span>
              </label>
              <div className="relative">
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full bg-cz-base border border-cz-border focus:border-cz-ember rounded-md px-3.5 py-2.5 text-xs sm:text-sm text-cz-bone focus:outline-none cursor-pointer pr-10"
                >
                  {availableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.model} / {p.provider_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Advanced Pipeline Settings Accordion */}
            <div className="border-t border-cz-border pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-xs font-semibold text-cz-muted hover:text-cz-bone transition-colors cursor-pointer py-1"
              >
                <span className="flex items-center space-x-2">
                  <Layers className="w-3.5 h-3.5 text-cz-ember" />
                  <span className="uppercase tracking-wider">Subtitle & Reframing Parameters</span>
                </span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-cz-border/40">
                  <div>
                    <label className="block text-[11px] font-semibold text-cz-bone mb-1.5">
                      Caption Animation Preset
                    </label>
                    <select
                      value={preset}
                      onChange={(e) => setPreset(e.target.value)}
                      className="w-full bg-cz-base border border-cz-border rounded px-3 py-2 text-xs text-cz-bone focus:outline-none focus:border-cz-ember"
                    >
                      <option value="karaoke">Karaoke (Line Highlight in Yellow)</option>
                      <option value="single">Single Word (Bold Pop-Up)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-cz-bone mb-1.5">
                      Reframing Camera Strategy
                    </label>
                    <select
                      value={reframe}
                      onChange={(e) => setReframe(e.target.value)}
                      className="w-full bg-cz-base border border-cz-border rounded px-3 py-2 text-xs text-cz-bone focus:outline-none focus:border-cz-ember"
                    >
                      <option value="auto">Auto (Face Tracking + Blur Fallback)</option>
                      <option value="face">Force Face Center-Lock</option>
                      <option value="blur">Letterbox with Blurred Background</option>
                      <option value="center">Static Center 9:16 Crop</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {localError && (
              <div className="bg-rose-950/40 border border-rose-800 text-rose-200 text-xs p-3 rounded-md flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{localError}</span>
              </div>
            )}

            {/* Heavyweight Primary CTA Button (Tier 1 Hero Action) */}
            <button
              type="submit"
              disabled={submitting || isJobActive}
              className="w-full py-3.5 sm:py-4 px-4 sm:px-6 bg-cz-ember hover:bg-cz-ember-hover active:translate-y-[2px] text-cz-bone font-display tracking-wider sm:tracking-widest text-xl sm:text-2xl uppercase rounded-md shadow-[0_4px_0_0_#9a2b05] active:shadow-[0_1px_0_0_#9a2b05] transition-all flex items-center justify-center space-x-2 sm:space-x-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Devouring Feed...</span>
                </>
              ) : isJobActive ? (
                <>
                  <Disc className="w-5 h-5 animate-reel-spin text-cz-bone" />
                  <span>Reel In Progress ({activeJob.progress}%)</span>
                </>
              ) : (
                <>
                  <Film className="w-5 h-5" />
                  <span>
                    {mode === 'batch'
                      ? `DEVOUR BATCH (${parsedBatchUrls.length || 0} REELS)`
                      : 'DEVOUR & GENERATE SHORTS'}
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Bottom Filmstrip Sprocket Border */}
        <div className="h-2 w-full sprocket-track-h opacity-60 border-t border-cz-border/50" />
      </div>

      {/* Live Active Job Reel Counter Deck (Tier 2 Hierarchy) */}
      {activeJob && (
        <div className="bg-cz-surface border border-cz-border rounded-lg p-6 shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 border-b border-cz-border pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 rounded bg-cz-base border border-cz-border flex items-center justify-center">
                {isJobActive && <Disc className="w-4 h-4 text-cz-ember animate-reel-spin" />}
                {isJobDone && <CheckCircle2 className="w-4 h-4 text-cz-sensor" />}
                {isJobFailed && <AlertCircle className="w-4 h-4 text-rose-400" />}
              </div>
              <div>
                <span className="font-display tracking-wider text-lg text-cz-bone uppercase block leading-none">
                  REEL DECK: {activeJob.status}
                </span>
                <span className="text-[11px] text-cz-muted font-sans">
                  {activeJob.video_id ? `Video Reel [${activeJob.video_id}]` : 'Processing feed'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              {/* Odometer Percentage Readout */}
              <div className="bg-cz-base border border-cz-border px-3 py-1 rounded font-display tracking-widest text-xl text-cz-ember tabular-nums">
                {String(activeJob.progress).padStart(3, '0')}%
              </div>
              {onDismissJob && (
                <button
                  type="button"
                  onClick={onDismissJob}
                  className="p-1 rounded text-cz-muted hover:text-cz-bone hover:bg-cz-raised transition-colors cursor-pointer"
                  title="Dismiss status"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 4-Stage Mechanical Reel Tape */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PIPELINE_STAGES.map((stg, i) => {
              const isPast = activeStageIdx > i;
              const isCurrent = activeStageIdx === i;

              return (
                <div
                  key={stg.key}
                  className={`p-2 rounded border text-center transition-all ${
                    isCurrent
                      ? 'bg-cz-ember-subtle border-cz-ember text-cz-bone shadow-sm'
                      : isPast
                      ? 'bg-cz-base border-cz-sensor/40 text-cz-sensor'
                      : 'bg-cz-base/50 border-cz-border text-cz-muted'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1.5 mb-1">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isCurrent
                          ? 'bg-cz-ember animate-ping'
                          : isPast
                          ? 'bg-cz-sensor'
                          : 'bg-cz-border'
                      }`}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {stg.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-sans block truncate opacity-80">
                    {isCurrent ? 'Active' : isPast ? 'Done' : 'Waiting'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress Message */}
          <p className="text-xs text-cz-muted mb-4 font-sans">
            {activeJob.stage_message || 'Clipzilla processing video...'}
          </p>

          {isJobFailed && activeJob.error_message && (
            <div className="text-xs text-rose-300 bg-rose-950/30 border border-rose-800/80 p-3 rounded mb-4 font-sans">
              {activeJob.error_message}
            </div>
          )}

          {/* Action on Complete */}
          <div className="flex items-center space-x-3">
            {isJobDone && (
              <button
                type="button"
                onClick={onNavigateToResults}
                className="flex-1 py-3 px-4 bg-cz-sensor hover:bg-emerald-600 text-cz-base rounded text-xs sm:text-sm font-bold tracking-wide uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md"
              >
                <Film className="w-4 h-4" />
                <span>View Spooled Shorts</span>
              </button>
            )}

            {onDismissJob && (
              <button
                type="button"
                onClick={onDismissJob}
                className="py-2.5 px-4 bg-cz-base hover:bg-cz-raised text-cz-muted hover:text-cz-bone border border-cz-border rounded text-xs font-semibold transition-colors cursor-pointer"
              >
                Dismiss Deck
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

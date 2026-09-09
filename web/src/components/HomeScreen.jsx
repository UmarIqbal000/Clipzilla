import React, { useState, useEffect, useRef } from 'react';
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
  FolderDown,
  Trash2,
  RotateCcw,
  Timer,
  Terminal,
  Copy,
  Check,
} from 'lucide-react';
import { apiGet, apiPost } from '../api/client';
import PillBadge from './PillBadge';

const PRESET_OPTIONS = [
  {
    id: 'youtube_shorts',
    name: 'YouTube Shorts',
    duration: 'Max 3 min',
    bitrate: '10 Mbps',
    icon: Tv,
    desc: 'Vertical 9:16 optimized for YouTube Shorts feed',
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
  onNavigateToSettings,
}) {
  const [mode, setMode] = useState('single');
  const [singleUrl, setSingleUrl] = useState('');
  const [batchUrlsText, setBatchUrlsText] = useState('');
  const [exportPreset, setExportPreset] = useState('youtube_shorts');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [availableProfiles, setAvailableProfiles] = useState([]);

  const [preset, setPreset] = useState('karaoke');
  const [reframe, setReframe] = useState('auto');
  const [outputDir, setOutputDir] = useState('output');
  const [deleteSource, setDeleteSource] = useState(true);
  const [numClips, setNumClips] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [localError, setLocalError] = useState('');
  const [triggerShutter, setTriggerShutter] = useState(false);

  const handleRetryJob = async (jobId) => {
    if (!jobId) return;
    setRetrying(true);
    try {
      await apiPost(`/jobs/${encodeURIComponent(jobId)}/retry`);
    } catch (err) {
      setLocalError(err.message || 'Failed to retry job.');
    } finally {
      setRetrying(false);
    }
  };

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
      output_dir: outputDir.trim() || undefined,
      delete_source: deleteSource,
      num_clips: Number(numClips) > 0 ? Number(numClips) : undefined,
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

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const terminalEndRef = useRef(null);

  // Initialize and run elapsed stopwatch
  useEffect(() => {
    if (!activeJob) {
      setElapsedSeconds(0);
      return;
    }
    if (activeJob.created_at) {
      try {
        const cleanCreatedAt = activeJob.created_at.includes('T')
          ? activeJob.created_at
          : activeJob.created_at.replace(' ', 'T') + 'Z';
        const startMs = new Date(cleanCreatedAt).getTime();
        if (!isNaN(startMs)) {
          const initialElapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          setElapsedSeconds(initialElapsed);
        }
      } catch {
        // fallback
      }
    }
  }, [activeJob?.id]);

  useEffect(() => {
    if (!isJobActive) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isJobActive]);

  // Poll terminal runtime logs from backend
  useEffect(() => {
    if (!activeJob?.id) return;
    let isMounted = true;

    const fetchLogs = async () => {
      try {
        const res = await apiGet(`/jobs/${activeJob.id}/logs`);
        if (isMounted && res && Array.isArray(res.logs)) {
          setTerminalLogs(res.logs);
        }
      } catch {
        // quiet fallback
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, isJobActive ? 1500 : 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeJob?.id, isJobActive]);

  // Auto-scroll terminal output
  useEffect(() => {
    if (autoScroll && terminalOpen && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, autoScroll, terminalOpen]);

  const formatDuration = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopyLogs = async () => {
    try {
      const text = terminalLogs
        .map((l) => `[${l.timestamp}] [${l.name || 'worker'}] [${l.level || 'INFO'}] ${l.message}`)
        .join('\n');
      await navigator.clipboard.writeText(text);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch {
      // fallback
    }
  };

  const progress = Number(activeJob?.progress) || 0;
  let etaText = null;
  if (isJobActive && progress > 5 && progress < 100 && elapsedSeconds > 2) {
    const totalEstimate = (elapsedSeconds / progress) * 100;
    const remainingSec = Math.max(1, Math.round(totalEstimate - elapsedSeconds));
    etaText = `~${formatDuration(remainingSec)}`;
  }

  const activeProfile = availableProfiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4">
      {/* Hero Header */}
      <div className="text-center mb-10">


        {/* Poster Headline with exactly ONE italic serif word in moss green */}
        <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-tight text-cz-ink uppercase leading-[0.9] mb-4 select-none">
          DEVOUR LONG-FORM.{' '}
          <span className="font-serif italic font-normal text-cz-moss lowercase tracking-normal">
            Spit
          </span>{' '}
          OUT SHORTS.
        </h1>

        <p className="text-cz-ink/80 text-sm sm:text-base max-w-xl mx-auto font-sans leading-relaxed">
          Clipzilla chews through long-form YouTube footage, tracks speaker faces with neural vision, and stamps punchy vertical reels with animated captions.
        </p>
      </div>

      {/* Main Devour Console (Poster Submission Form) */}
      <div
        className={`bg-cz-parchment border-2 border-cz-ink p-6 sm:p-8 relative transition-all shadow-[4px_4px_0px_#18140F] mb-10 ${
          triggerShutter ? 'translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0px_#18140F]' : ''
        }`}
      >
        {/* Decorative Ticket Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-cz-ink pb-4 mb-6">
          <div className="flex items-center space-x-2">
            <span className="font-display text-lg tracking-wider uppercase text-cz-ink">
              INTAKE DISPATCH SLIP
            </span>
            <span className="text-xs font-mono font-bold text-cz-rust px-2 py-0.5 bg-cz-paper border border-cz-ink whitespace-nowrap">
              FORM #CZ-2026
            </span>
          </div>

          <div className="flex space-x-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-3 py-1 text-xs font-bold font-sans transition-all cursor-pointer ${
                mode === 'single'
                  ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                  : 'bg-cz-paper text-cz-ink border-2 border-cz-ink/30 hover:border-cz-ink'
              }`}
            >
              Single Reel
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`px-3 py-1 text-xs font-bold font-sans transition-all cursor-pointer ${
                mode === 'batch'
                  ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                  : 'bg-cz-paper text-cz-ink border-2 border-cz-ink/30 hover:border-cz-ink'
              }`}
            >
              Batch Spool
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Submission Chamber */}
          {mode === 'single' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-cz-ink uppercase tracking-wider">
                  Target YouTube Video URL
                </label>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-xs text-cz-rust hover:text-cz-rust-hover font-bold flex items-center space-x-1 cursor-pointer transition-colors"
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
                  className="w-full bg-cz-paper border-2 border-cz-ink focus:border-cz-rust focus:outline-none rounded-none px-4 py-3 text-cz-ink placeholder:text-cz-ink/40 transition-all pr-20 text-sm font-sans"
                />
                {singleUrl && (
                  <button
                    type="button"
                    onClick={() => setSingleUrl('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-cz-parchment hover:bg-cz-paper border border-cz-ink text-cz-ink px-2 py-1 font-bold transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-2 gap-1 text-[11px] text-cz-ink/70 font-sans">
                <span>Standard YouTube, youtu.be, or stream archive link</span>
                <button
                  type="button"
                  onClick={() => setSingleUrl('https://www.youtube.com/watch?v=yFvl2x8_9gI')}
                  className="text-cz-rust hover:underline font-semibold cursor-pointer text-left sm:text-right"
                >
                  Sample: Load Claude Code Video
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-cz-ink uppercase tracking-wider">
                  Batch YouTube URLs (One per line)
                </label>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-xs text-cz-rust hover:text-cz-rust-hover font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>Paste Links</span>
                  </button>
                  <span className="text-xs px-2 py-0.5 bg-cz-paper text-cz-ink font-bold border border-cz-ink tabular-nums">
                    {parsedBatchUrls.length} {parsedBatchUrls.length === 1 ? 'reel' : 'reels'}
                  </span>
                </div>
              </div>

              <textarea
                rows={4}
                value={batchUrlsText}
                onChange={(e) => setBatchUrlsText(e.target.value)}
                placeholder={'https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=...'}
                className="w-full bg-cz-paper border-2 border-cz-ink focus:border-cz-rust focus:outline-none rounded-none px-4 py-3 text-cz-ink placeholder:text-cz-ink/40 transition-all text-xs sm:text-sm font-sans leading-relaxed"
              />
              <p className="text-[11px] text-cz-ink/70 mt-1 font-sans">
                Paste each YouTube URL on a new line. The engine spools each video sequentially.
              </p>
            </div>
          )}

          {/* Export Presets Treated as Interactive Pill Badges */}
          <div>
            <label className="block text-xs font-bold text-cz-ink uppercase tracking-wider mb-2.5">
              Target Export Preset
            </label>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = exportPreset === opt.id;
                return (
                  <PillBadge
                    key={opt.id}
                    icon={opt.icon}
                    label={opt.name}
                    sublabel={opt.duration}
                    chipColor={isSelected ? 'rust' : 'ink'}
                    active={isSelected}
                    onClick={() => setExportPreset(opt.id)}
                    className="text-xs"
                  />
                );
              })}
            </div>
          </div>

          {/* AI Retention Profile & Target Clip Count */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-cz-ink uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-cz-rust" />
                <span>AI Retention Analysis Engine</span>
              </label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full bg-cz-paper border-2 border-cz-ink focus:border-cz-rust rounded-none px-3.5 py-2.5 text-xs sm:text-sm text-cz-ink focus:outline-none cursor-pointer font-sans"
              >
                {availableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model} &bull; {p.provider_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-cz-ink uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cz-rust" />
                  <span>Target Clips</span>
                </span>
                <span className="text-[10px] text-cz-ink/60 font-normal">Count</span>
              </label>
              <div className="flex items-center space-x-1.5">
                {[3, 5, 10, 15].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setNumClips(count)}
                    className={`flex-1 py-2 text-xs font-bold transition-all cursor-pointer ${
                      Number(numClips) === count
                        ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[1px_1px_0px_#18140F]'
                        : 'bg-cz-paper border-2 border-cz-ink/30 text-cz-ink hover:border-cz-ink'
                    }`}
                  >
                    {count}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={numClips}
                  onChange={(e) => setNumClips(e.target.value)}
                  className="w-14 bg-cz-paper border-2 border-cz-ink focus:border-cz-rust px-2 py-2 text-xs text-cz-ink text-center font-bold"
                  title="Custom clip count"
                />
              </div>
            </div>
          </div>

          {/* Advanced Accordion */}
          <div className="border-t-2 border-cz-ink/20 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs font-bold text-cz-ink hover:text-cz-rust transition-colors cursor-pointer py-1"
            >
              <span className="flex items-center space-x-2">
                <Layers className="w-3.5 h-3.5 text-cz-rust" />
                <span className="uppercase tracking-wider">Subtitles & Reframing Options</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-cz-ink/20 font-sans">
                <div>
                  <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                    Caption Animation Style
                  </label>
                  <select
                    value={preset}
                    onChange={(e) => setPreset(e.target.value)}
                    className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust"
                  >
                    <option value="karaoke">Karaoke (Word-by-word highlight)</option>
                    <option value="single">Single Word (Bold pop-up)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                    Reframing Vision Strategy
                  </label>
                  <select
                    value={reframe}
                    onChange={(e) => setReframe(e.target.value)}
                    className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust"
                  >
                    <option value="auto">Auto (Face Tracking + Blur Fallback)</option>
                    <option value="face">Force Center-Lock on Face</option>
                    <option value="blur">Letterbox with Blurred Background</option>
                    <option value="center">Static Center 9:16 Crop</option>
                  </select>
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-cz-ink/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1 flex items-center space-x-1.5">
                        <FolderDown className="w-3.5 h-3.5 text-cz-rust" />
                        <span>Output Directory</span>
                      </label>
                      <input
                        type="text"
                        value={outputDir}
                        onChange={(e) => setOutputDir(e.target.value)}
                        placeholder="output"
                        className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust font-mono"
                      />
                    </div>

                    <div className="flex items-center pt-2 sm:pt-4">
                      <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={deleteSource}
                          onChange={(e) => setDeleteSource(e.target.checked)}
                          className="mt-0.5 rounded-none border-2 border-cz-ink text-cz-rust focus:ring-cz-rust bg-cz-paper cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-cz-ink flex items-center space-x-1">
                            <Trash2 className="w-3 h-3 text-cz-rust inline mr-1" />
                            Delete Original Video
                          </span>
                          <span className="text-[10px] text-cz-ink/70 block leading-tight mt-0.5">
                            Purges downloaded 1080p source after clipping to reclaim disk space
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Local Error Warning */}
          {localError && (
            <div className="bg-cz-paper border-2 border-cz-rust text-cz-rust text-xs p-3 font-sans font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-cz-rust" />
              <span>{localError}</span>
            </div>
          )}

          {/* Poster Primary Button: Solid Rust Fill, Hard Offset Shadow, Sentence Case */}
          <button
            type="submit"
            disabled={submitting || isJobActive}
            className="w-full py-4 px-6 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper font-sans font-bold text-lg sm:text-xl rounded-none border-2 border-cz-ink shadow-[3px_3px_0px_#18140F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#18140F] transition-all flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Devouring feed...</span>
              </>
            ) : isJobActive ? (
              <>
                <Disc className="w-5 h-5 animate-reel-spin text-cz-paper" />
                <span>Reel in progress ({activeJob.progress}%)</span>
              </>
            ) : (
              <>
                <Film className="w-5 h-5" />
                <span>
                  {mode === 'batch'
                    ? `Devour batch (${parsedBatchUrls.length || 0} reels)`
                    : 'Devour & generate shorts'}
                </span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Live Active Job Reel Deck */}
      {activeJob && (
        <div className="bg-cz-parchment border-2 border-cz-ink p-6 shadow-[4px_4px_0px_#18140F] relative overflow-hidden">
          <div className="flex items-center justify-between mb-3 border-b-2 border-cz-ink pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-none bg-cz-paper border-2 border-cz-ink flex items-center justify-center">
                {isJobActive && <Disc className="w-4 h-4 text-cz-rust animate-reel-spin" />}
                {isJobDone && <CheckCircle2 className="w-4 h-4 text-cz-moss" />}
                {isJobFailed && <AlertCircle className="w-4 h-4 text-cz-rust" />}
              </div>
              <div>
                <span className="font-display tracking-wider text-xl text-cz-ink uppercase block leading-none">
                  PROCESSING DECK: {activeJob.status}
                </span>
                <span className="text-[11px] text-cz-ink/70 font-sans">
                  {activeJob.video_id ? `Video Reel [${activeJob.video_id}]` : 'Processing feed'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Digital Stopwatch Timer Badge */}
              <div className="bg-cz-paper border-2 border-cz-ink px-3 py-1 flex items-center space-x-2 shadow-[2px_2px_0px_#18140F]">
                <Timer className={`w-4 h-4 text-cz-rust ${isJobActive ? 'animate-pulse' : ''}`} />
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-mono uppercase font-bold tracking-wider text-cz-ink/60 leading-none">
                    {isJobDone ? 'TOTAL' : 'ELAPSED'}
                  </span>
                  <span className="font-mono font-bold text-base text-cz-ink leading-tight tabular-nums">
                    {formatDuration(elapsedSeconds)}
                  </span>
                </div>
              </div>

              {/* Estimated Remaining Time Badge */}
              {isJobActive && etaText && (
                <div className="hidden sm:flex bg-cz-paper/90 border-2 border-cz-ink/70 px-2.5 py-1 flex-col justify-center text-left">
                  <span className="text-[9px] font-mono uppercase font-bold tracking-wider text-cz-ink/50 leading-none">
                    EST. REMAINING
                  </span>
                  <span className="font-mono font-bold text-xs text-cz-moss leading-tight tabular-nums">
                    {etaText}
                  </span>
                </div>
              )}

              {/* Percentage Stat Number */}
              <div className="bg-cz-paper border-2 border-cz-ink px-3 py-1 font-display tracking-wider text-2xl text-cz-rust tabular-nums shadow-[2px_2px_0px_#18140F]">
                {String(activeJob.progress).padStart(3, '0')}%
              </div>

              {onDismissJob && (
                <button
                  type="button"
                  onClick={onDismissJob}
                  className="p-1.5 text-cz-ink/70 hover:text-cz-ink hover:bg-cz-paper border border-transparent hover:border-cz-ink transition-colors cursor-pointer"
                  title="Dismiss deck"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Real-time Progress Fill Bar */}
          <div className="w-full h-2.5 bg-cz-paper border-2 border-cz-ink mb-4 p-0.5 relative overflow-hidden shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)]">
            <div
              className={`h-full transition-all duration-300 ${
                isJobDone ? 'bg-cz-moss' : isJobFailed ? 'bg-cz-rust' : 'bg-cz-rust'
              }`}
              style={{ width: `${Math.min(100, Math.max(2, activeJob.progress))}%` }}
            />
          </div>

          {/* 4-Stage Mechanical Tape */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PIPELINE_STAGES.map((stg, i) => {
              const isPast = activeStageIdx > i;
              const isCurrent = activeStageIdx === i;

              return (
                <div
                  key={stg.key}
                  className={`p-2 border-2 text-center transition-all ${
                    isCurrent
                      ? 'bg-cz-rust text-cz-paper border-cz-ink shadow-[2px_2px_0px_#18140F]'
                      : isPast
                      ? 'bg-cz-paper text-cz-moss border-cz-moss font-bold'
                      : 'bg-cz-paper/50 text-cz-ink/50 border-cz-ink/30'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1 mb-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider font-sans">
                      {stg.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-sans block truncate opacity-90">
                    {isCurrent ? 'Active' : isPast ? 'Done' : 'Waiting'}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-cz-ink/80 mb-3 font-sans font-medium">
            {activeJob.stage_message || 'Clipzilla processing video...'}
          </p>

          {/* Live Embedded Runtime Terminal */}
          <div className="mt-3 mb-4 border-2 border-cz-ink bg-[#13110E] shadow-[3px_3px_0px_#18140F] overflow-hidden">
            {/* Terminal Window Header Bar */}
            <div className="bg-[#1C1814] px-3 py-2 border-b-2 border-cz-ink flex items-center justify-between select-none">
              <div className="flex items-center space-x-2">
                {/* Window Traffic Lights */}
                <div className="flex items-center space-x-1.5 mr-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#E63946] border border-black/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F4A261] border border-black/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#52B788] border border-black/40" />
                </div>
                <div className="flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cz-paper/70" />
                  <span className="font-mono text-xs font-bold text-cz-paper uppercase tracking-wider">
                    RUNTIME TERMINAL
                  </span>
                </div>
                {isJobActive && (
                  <span className="flex items-center space-x-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700/50 px-1.5 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span>STREAMING</span>
                  </span>
                )}
                <span className="hidden sm:inline-block text-[10px] font-mono text-cz-paper/40">
                  {terminalLogs.length} events logged
                </span>
              </div>

              {/* Terminal Action Controls */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setAutoScroll((prev) => !prev)}
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border transition-colors cursor-pointer ${
                    autoScroll
                      ? 'bg-cz-moss/50 text-emerald-300 border-emerald-600'
                      : 'bg-transparent text-cz-paper/50 border-cz-paper/20 hover:text-cz-paper'
                  }`}
                  title="Toggle auto-scroll to newest line"
                >
                  Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
                </button>

                <button
                  type="button"
                  onClick={handleCopyLogs}
                  className="p-1 text-cz-paper/70 hover:text-cz-paper hover:bg-white/10 border border-cz-paper/20 transition-colors cursor-pointer"
                  title="Copy terminal logs"
                >
                  {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setTerminalOpen((prev) => !prev)}
                  className="p-1 text-cz-paper/70 hover:text-cz-paper hover:bg-white/10 border border-cz-paper/20 transition-colors cursor-pointer"
                  title={terminalOpen ? 'Collapse terminal' : 'Expand terminal'}
                >
                  {terminalOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Terminal Screen Body */}
            {terminalOpen && (
              <div className="p-3.5 max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed text-cz-paper select-text space-y-1">
                {terminalLogs.length === 0 ? (
                  <div className="text-cz-paper/40 italic py-3 flex items-center space-x-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cz-rust" />
                    <span>Awaiting runtime stream from Clipzilla worker daemon (dev.py)...</span>
                  </div>
                ) : (
                  terminalLogs.map((log, idx) => {
                    const isErr = log.level === 'ERROR';
                    const isWarn = log.level === 'WARNING';
                    const name = log.name || 'core';

                    const nameColors = {
                      worker: 'text-amber-400',
                      downloader: 'text-cyan-400',
                      transcriber: 'text-violet-400',
                      analyzer: 'text-emerald-400',
                      clipper: 'text-orange-400',
                      ffmpeg: 'text-pink-400',
                      system: 'text-gray-400',
                    };
                    const badgeColor = nameColors[name] || 'text-amber-300';

                    return (
                      <div key={idx} className="flex items-start space-x-2 font-mono hover:bg-white/[0.03] py-0.5">
                        <span className="text-cz-paper/30 shrink-0 select-none">
                          [{log.timestamp}]
                        </span>
                        <span className={`${badgeColor} font-bold shrink-0`}>
                          [{name}]
                        </span>
                        <span
                          className={`break-all ${
                            isErr
                              ? 'text-red-400 font-bold'
                              : isWarn
                              ? 'text-yellow-300 font-semibold'
                              : 'text-[#F1EAD8]/90'
                          }`}
                        >
                          {log.message}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={terminalEndRef} className="pt-1 flex items-center space-x-1 text-cz-moss">
                  <span className="text-cz-paper/40">&gt;</span>
                  <span className="w-2 h-3.5 bg-emerald-400 inline-block animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {isJobFailed && activeJob.error_message && (
            <div className="text-xs text-cz-rust bg-cz-paper border-2 border-cz-rust p-3 mb-4 font-sans font-bold">
              {activeJob.error_message}
            </div>
          )}

          {isJobFailed && (
            <button
              type="button"
              onClick={() => handleRetryJob(activeJob.id)}
              disabled={retrying}
              className="w-full py-3 px-4 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F] font-sans font-bold text-sm tracking-wide transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
              <span>{retrying ? 'Re-queueing Job...' : 'Retry Processing'}</span>
            </button>
          )}

          {isJobDone && (
            <button
              type="button"
              onClick={onNavigateToResults}
              className="w-full py-3 px-4 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F] font-sans font-bold text-sm tracking-wide transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Film className="w-4 h-4" />
              <span>Inspect spooled shorts</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Scissors,
  Save,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Crop,
  Type,
  Palette,
  Eye,
  Sliders,
  Maximize2,
  RefreshCw,
  User,
  Users,
  Grid,
  Trash2,
  Plus,
  Video,
  Film,
  CaseSensitive,
  MoveVertical,
} from 'lucide-react';

const FONTS = [
  { id: 'Bebas Neue', name: 'Bebas Neue', style: { fontFamily: '"Bebas Neue", sans-serif' }, desc: 'Viral Punchy Hook' },
  { id: 'Montserrat', name: 'Montserrat', style: { fontFamily: '"Montserrat", sans-serif', fontWeight: 800 }, desc: 'Modern High-Retention' },
  { id: 'Impact', name: 'Impact', style: { fontFamily: 'Impact, sans-serif' }, desc: 'Classic Meme Impact' },
  { id: 'Anton', name: 'Anton', style: { fontFamily: '"Anton", sans-serif' }, desc: 'Heavy Headline' },
  { id: 'Oswald', name: 'Oswald', style: { fontFamily: '"Oswald", sans-serif', fontWeight: 700 }, desc: 'Condensed Power' },
  { id: 'Permanent Marker', name: 'Permanent Marker', style: { fontFamily: '"Permanent Marker", cursive' }, desc: 'Graffiti / Rebel' },
  { id: 'JetBrains Mono', name: 'JetBrains Mono', style: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }, desc: 'Clean Monospace' },
  { id: 'Arial Black', name: 'Arial Black', style: { fontFamily: '"Arial Black", sans-serif' }, desc: 'Heavy Street Block' },
  { id: 'Trebuchet MS', name: 'Trebuchet MS', style: { fontFamily: '"Trebuchet MS", sans-serif', fontWeight: 700 }, desc: 'Vintage Stylized' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Warm Amber', val: 'amber', hex: '#F59E0B' },
  { name: 'Electric Yellow', val: 'yellow', hex: '#FFFF00' },
  { name: 'Vibrant Green', val: 'green', hex: '#10B981' },
  { name: 'Electric Cyan', val: 'cyan', hex: '#00FFFF' },
  { name: 'Crimson Red', val: 'red', hex: '#EF4444' },
  { name: 'Hot Pink', val: 'magenta', hex: '#EC4899' },
  { name: 'Pure White', val: 'white', hex: '#FFFFFF' },
];

const TEXT_COLORS = [
  { name: 'Pure White', val: 'white', hex: '#FFFFFF' },
  { name: 'Cream Paper', val: 'cream', hex: '#FAF6EF' },
  { name: 'Soft Yellow', val: 'yellow', hex: '#FEF08A' },
  { name: 'Amber Tint', val: 'amber', hex: '#FDE68A' },
];

const FONT_SIZES = [
  { label: 'Compact', val: 64 },
  { label: 'Standard', val: 76 },
  { label: 'Impact', val: 88 },
  { label: 'Giant', val: 104 },
];

export default function EditorScreen({ clip, onBack, onClipUpdated }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorData, setEditorData] = useState(null);

  // Playback state
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [mediaSourceType, setMediaSourceType] = useState('proxy'); // 'proxy' or 'rendered'
  const [viewMode, setViewMode] = useState('canvas'); // 'canvas' (16:9) or 'crop' (9:16)

  // Edit states
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [captions, setCaptions] = useState([]);
  const [selectedCaptionId, setSelectedCaptionId] = useState(null);
  const [editingCaptionText, setEditingCaptionText] = useState('');
  const [cropOverride, setCropOverride] = useState({ mode: 'auto', center_x: 0.5 });
  const [style, setStyle] = useState({
    preset: 'karaoke',
    font_name: 'Bebas Neue',
    font_size: 76,
    highlight_color: 'amber',
    text_color: 'white',
    text_case: 'uppercase', // uppercase, capitalize, normal
    position: 'bottom',
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderMessage, setRenderMessage] = useState('');

  // Dragging states
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    if (!clip?.id) return;
    loadEditorData(clip.id);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [clip?.id]);

  const loadEditorData = async (clipId) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/clips/${clipId}/editor-data`);
      if (!res.ok) throw new Error('Failed to load clip editor data.');
      const data = await res.json();
      setEditorData(data);

      const edits = data.edits || {};
      const start = edits.trim_start ?? data.clip.start_time;
      const end = edits.trim_end ?? data.clip.end_time;

      setTrimStart(start);
      setTrimEnd(end);
      setCurrentTime(start);

      setCaptions(data.captions || []);

      if (edits.crop_override) {
        setCropOverride(edits.crop_override);
      } else {
        setCropOverride({ mode: 'auto', center_x: 0.5 });
      }

      if (edits.style) {
        setStyle((prev) => ({ ...prev, ...edits.style }));
      }

      if (data.render_status === 'rendering') {
        setIsRendering(true);
        startPollingRender(clipId);
      } else {
        setIsRendering(false);
      }

      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err.message || 'Failed to initialize editor');
    } finally {
      setLoading(false);
    }
  };

  const markDirty = () => {
    setHasUnsavedChanges(true);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    if (mediaSourceType === 'proxy') {
      if (t >= trimEnd) {
        videoRef.current.currentTime = trimStart;
        if (!isPlaying) videoRef.current.pause();
      } else if (t < trimStart - 0.2) {
        videoRef.current.currentTime = trimStart;
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (mediaSourceType === 'proxy') {
        if (videoRef.current.currentTime >= trimEnd || videoRef.current.currentTime < trimStart) {
          videoRef.current.currentTime = trimStart;
        }
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const seekTo = (t) => {
    const clamped = mediaSourceType === 'proxy'
      ? Math.max(trimStart, Math.min(trimEnd, t))
      : Math.max(0, Math.min(videoDuration || 3600, t));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    setCurrentTime(clamped);
  };

  const handleTrimStartChange = (newVal) => {
    const val = Math.max(0, Math.min(trimEnd - 0.5, newVal));
    setTrimStart(val);
    markDirty();
    if (currentTime < val) seekTo(val);
  };

  const handleTrimEndChange = (newVal) => {
    const maxBound = videoDuration > 0 ? videoDuration : 3600;
    const val = Math.min(maxBound, Math.max(trimStart + 0.5, newVal));
    setTrimEnd(val);
    markDirty();
    if (currentTime > val) seekTo(trimStart);
  };

  // Crop calculations
  const activeCropCenterX = useMemo(() => {
    if (cropOverride.mode === 'center') return 0.5;
    if (cropOverride.mode === 'left') return 0.25;
    if (cropOverride.mode === 'right') return 0.75;
    if (cropOverride.mode === 'manual') return cropOverride.center_x ?? 0.5;

    if (editorData?.crop_path && editorData.crop_path.length > 0) {
      const relT = currentTime - trimStart;
      let closest = editorData.crop_path[0];
      let minDiff = 999999;
      for (const pt of editorData.crop_path) {
        const diff = Math.abs(pt.time - relT);
        if (diff < minDiff) {
          minDiff = diff;
          closest = pt;
        }
      }
      return closest.center_x ?? 0.5;
    }
    return 0.5;
  }, [cropOverride, editorData?.crop_path, currentTime, trimStart]);

  const handleSetCropMode = (mode, cx = 0.5) => {
    setCropOverride({ mode, center_x: cx });
    markDirty();
  };

  const handleCropOverlayMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingCrop(true);
  };

  const handleCropMouseMove = (e) => {
    if (!isDraggingCrop) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const normalized = Math.max(0.16, Math.min(0.84, x / rect.width));
    setCropOverride({ mode: 'manual', center_x: Number(normalized.toFixed(3)) });
    markDirty();
  };

  const handleCropMouseUp = () => {
    setIsDraggingCrop(false);
  };

  // Caption Editing
  const handleSelectCaption = (cap) => {
    setSelectedCaptionId(cap.id);
    setEditingCaptionText(cap.text);
    seekTo(cap.start);
  };

  const handleUpdateCaptionText = () => {
    if (!selectedCaptionId) return;
    setCaptions((prev) =>
      prev.map((c) => (c.id === selectedCaptionId ? { ...c, text: editingCaptionText } : c))
    );
    markDirty();
  };

  const handleAddCaption = () => {
    const newId = `cap_${Date.now()}`;
    const start = currentTime;
    const end = Math.min(trimEnd, currentTime + 2.0);
    const newCap = { id: newId, start: Number(start.toFixed(2)), end: Number(end.toFixed(2)), text: 'New caption phrase' };
    setCaptions((prev) => [...prev, newCap].sort((a, b) => a.start - b.start));
    setSelectedCaptionId(newId);
    setEditingCaptionText(newCap.text);
    markDirty();
  };

  const handleDeleteCaption = (capId) => {
    setCaptions((prev) => prev.filter((c) => c.id !== capId));
    if (selectedCaptionId === capId) {
      setSelectedCaptionId(null);
      setEditingCaptionText('');
    }
    markDirty();
  };

  // Current active caption
  const currentActiveCaption = useMemo(() => {
    return captions.find((c) => currentTime >= c.start && currentTime <= c.end);
  }, [captions, currentTime]);

  // Format text according to case
  const formatCaptionCase = (text) => {
    if (!text) return '';
    if (style.text_case === 'uppercase') return text.toUpperCase();
    if (style.text_case === 'capitalize') {
      return text.replace(/\b\w/g, (l) => l.toUpperCase());
    }
    return text;
  };

  // Save Edits
  const handleSaveEdits = async () => {
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        trim_start: trimStart,
        trim_end: trimEnd,
        captions: captions,
        crop_override: cropOverride,
        style: style,
      };

      const res = await fetch(`/clips/${clip.id}/edits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save edits');
      setHasUnsavedChanges(false);
      if (onClipUpdated) {
        onClipUpdated({ ...clip, edits: payload });
      }
    } catch (err) {
      setError(err.message || 'Error saving edits');
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger Re-Render
  const handleTriggerRerender = async () => {
    setIsRendering(true);
    setRenderMessage('Queued high-resolution re-render...');
    try {
      const payload = {
        trim_start: trimStart,
        trim_end: trimEnd,
        captions: captions,
        crop_override: cropOverride,
        style: style,
      };

      const res = await fetch(`/clips/${clip.id}/rerender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Re-render trigger failed');
      }

      setHasUnsavedChanges(false);
      startPollingRender(clip.id);
    } catch (err) {
      setIsRendering(false);
      setError(err.message || 'Failed to start re-render');
    }
  };

  const startPollingRender = (clipId) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/clips/${clipId}`);
        if (!res.ok) return;
        const clipData = await res.json();

        if (clipData.render_status === 'idle') {
          clearInterval(pollingIntervalRef.current);
          setIsRendering(false);
          setRenderMessage('');
          // Switch to rendered video mode to preview result!
          setMediaSourceType('rendered');
          if (onClipUpdated) onClipUpdated(clipData);
          if (videoRef.current) videoRef.current.load();
        } else if (clipData.render_status === 'failed') {
          clearInterval(pollingIntervalRef.current);
          setIsRendering(false);
          setError(`Render failed: ${clipData.render_error || 'Unknown rendering error'}`);
        } else {
          setRenderMessage('Rendering 9:16 short with updated fonts & captions...');
        }
      } catch (err) {
        console.error('Polling render error:', err);
      }
    }, 2000);
  };

  const formatSeconds = (sec) => {
    if (!sec && sec !== 0) return '0:00.0';
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m}:${s.padStart(4, '0')}`;
  };

  const cropBoxWidthPercent = 31.25; // (9/16)/(16/9)
  const cropBoxLeftPercent = Math.max(0, Math.min(100 - cropBoxWidthPercent, (activeCropCenterX * 100) - (cropBoxWidthPercent / 2)));

  const activeFontFamily = FONTS.find((f) => f.id === style.font_name)?.style?.fontFamily || '"Bebas Neue", sans-serif';
  const activeHighlightHex = HIGHLIGHT_COLORS.find((c) => c.val === style.highlight_color)?.hex || '#F59E0B';
  const activeTextHex = TEXT_COLORS.find((c) => c.val === style.text_color)?.hex || '#FFFFFF';

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-24 text-center">
        <div className="w-12 h-12 rounded-lg bg-cz-surface border border-cz-border flex items-center justify-center mx-auto mb-4 text-cz-ember">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="font-display text-2xl tracking-wide text-cz-bone uppercase">INITIALIZING STUDIO TIMELINE...</p>
        <p className="text-xs text-cz-muted mt-1 font-sans">Loading scrubbing proxy and caption tracks</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-cz-border">
        <div className="flex items-center space-x-3.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded bg-cz-surface hover:bg-cz-raised text-cz-muted hover:text-cz-bone border border-cz-border transition-colors cursor-pointer shrink-0"
            title="Return to Vault"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-cz-bone uppercase truncate leading-none">
                REEL STUDIO PANEL
              </h2>
              {hasUnsavedChanges && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cz-ember-subtle border border-cz-ember text-cz-ember font-bold shrink-0">
                  Unsaved Draft
                </span>
              )}
            </div>
            <p className="text-xs text-cz-muted truncate mt-0.5 font-sans">
              Editing: <strong className="text-cz-bone">{clip?.title}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleSaveEdits}
            disabled={isSaving || isRendering || !hasUnsavedChanges}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-cz-raised hover:bg-cz-border border border-cz-border text-xs font-semibold text-cz-bone transition-all disabled:opacity-40 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerRerender}
            disabled={isRendering}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-cz-ember hover:bg-cz-ember-hover text-cz-base text-xs font-black uppercase tracking-wider transition-all shadow-[0_2px_0_0_#92400e] active:translate-y-[1px] disabled:opacity-50 cursor-pointer"
          >
            {isRendering ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cz-base" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isRendering ? 'Rendering...' : 'Re-Render Short'}</span>
          </button>
        </div>
      </div>

      {/* Render In-Flight Notice */}
      {isRendering && (
        <div className="mb-6 p-4 rounded-lg bg-cz-ember-subtle border border-cz-ember/60 flex items-center justify-between text-cz-bone">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-cz-ember animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-cz-ember uppercase tracking-wider font-mono">
                RENDER IN PROGRESS
              </p>
              <p className="text-xs text-cz-bone/90 mt-0.5 font-sans">
                {renderMessage || 'Processing full-resolution 9:16 vertical render with new fonts...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-start space-x-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <span className="font-bold block">Studio Notice:</span>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Studio 2-Column Work Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Video Monitor + Multi-Track Timeline */}
        <div className="lg:col-span-2 space-y-5">
          {/* Video Player Card */}
          <div className="bg-cz-surface border border-cz-border rounded-xl p-4 shadow-xl">
            {/* Monitor Header Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-cz-border/60">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-mono font-bold text-cz-muted uppercase tracking-wider">
                  MONITOR:
                </span>
                {/* Source Switcher */}
                <div className="flex items-center rounded bg-cz-base border border-cz-border p-0.5">
                  <button
                    type="button"
                    onClick={() => setMediaSourceType('proxy')}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      mediaSourceType === 'proxy'
                        ? 'bg-cz-ember text-cz-base font-bold'
                        : 'text-cz-muted hover:text-cz-bone'
                    }`}
                  >
                    Scrubbing Track (Proxy)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaSourceType('rendered')}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      mediaSourceType === 'rendered'
                        ? 'bg-cz-ember text-cz-base font-bold'
                        : 'text-cz-muted hover:text-cz-bone'
                    }`}
                  >
                    Rendered Short (9:16 MP4)
                  </button>
                </div>
              </div>

              {mediaSourceType === 'proxy' && (
                <div className="flex items-center space-x-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('canvas')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                      viewMode === 'canvas'
                        ? 'bg-cz-raised border-cz-ember text-cz-ember'
                        : 'border-cz-border text-cz-muted hover:text-cz-bone'
                    }`}
                  >
                    16:9 Stage
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('crop')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                      viewMode === 'crop'
                        ? 'bg-cz-raised border-cz-ember text-cz-ember'
                        : 'border-cz-border text-cz-muted hover:text-cz-bone'
                    }`}
                  >
                    9:16 Scope
                  </button>
                </div>
              )}
            </div>

            {/* Video Viewport */}
            <div
              onMouseMove={mediaSourceType === 'proxy' ? handleCropMouseMove : undefined}
              onMouseUp={mediaSourceType === 'proxy' ? handleCropMouseUp : undefined}
              className={`relative bg-black rounded-lg overflow-hidden flex items-center justify-center mx-auto ${
                mediaSourceType === 'rendered' || viewMode === 'crop'
                  ? 'aspect-[9/16] max-h-[500px]'
                  : 'aspect-video w-full'
              }`}
            >
              <video
                ref={videoRef}
                src={mediaSourceType === 'rendered' ? clip?.video_url : (editorData?.proxy_url || clip?.video_url)}
                className={`w-full h-full object-contain ${
                  mediaSourceType === 'proxy' && viewMode === 'crop' ? 'scale-[1.78] object-cover' : ''
                }`}
                style={
                  mediaSourceType === 'proxy' && viewMode === 'crop'
                    ? { transformOrigin: `${activeCropCenterX * 100}% center` }
                    : undefined
                }
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
                playsInline
              />

              {/* 9:16 Interactive Crop Box (in 16:9 canvas mode) */}
              {mediaSourceType === 'proxy' && viewMode === 'canvas' && cropOverride.mode !== 'blur' && (
                <div
                  onMouseDown={handleCropOverlayMouseDown}
                  style={{
                    left: `${cropBoxLeftPercent}%`,
                    width: `${cropBoxWidthPercent}%`,
                  }}
                  className={`absolute top-0 bottom-0 border-2 border-cz-ember bg-cz-ember/15 cursor-ew-resize transition-all ${
                    isDraggingCrop ? 'border-dashed bg-cz-ember/30' : ''
                  }`}
                >
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-cz-base/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-cz-ember font-bold border border-cz-ember/40 pointer-events-none whitespace-nowrap shadow">
                    9:16 Focus ({Math.round(activeCropCenterX * 100)}%)
                  </div>
                  <div className="w-px h-full bg-cz-ember/40 mx-auto pointer-events-none" />
                </div>
              )}

              {/* Live Subtitle Overlay Preview (When previewing on timeline track) */}
              {mediaSourceType === 'proxy' && currentActiveCaption && (
                <div
                  className={`absolute left-0 right-0 px-6 text-center pointer-events-none z-10 ${
                    style.position === 'top'
                      ? 'top-8'
                      : style.position === 'middle'
                      ? 'top-1/2 -translate-y-1/2'
                      : 'bottom-8'
                  }`}
                >
                  <div
                    style={{
                      fontFamily: activeFontFamily,
                      fontSize: `${Math.round(style.font_size * 0.32)}px`,
                      textShadow: '0 3px 10px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.9)',
                      letterSpacing: style.font_name === 'Bebas Neue' ? '0.05em' : 'normal',
                    }}
                    className="inline-block px-3 py-1 font-black rounded"
                  >
                    <span style={{ color: activeHighlightHex }}>
                      {formatCaptionCase(currentActiveCaption.text)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Playback Controls & Time Bar */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-cz-border text-xs">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-2 rounded bg-cz-ember hover:bg-cz-ember-hover text-cz-base font-black transition-all cursor-pointer shadow-[0_2px_0_0_#92400e]"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => seekTo(mediaSourceType === 'proxy' ? trimStart : 0)}
                  className="p-2 rounded bg-cz-base hover:bg-cz-raised text-cz-bone border border-cz-border transition-colors cursor-pointer"
                  title="Rewind to start"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-3 font-mono text-cz-muted text-xs">
                <span>
                  Pos: <strong className="text-cz-bone">{formatSeconds(currentTime)}</strong>
                </span>
                <span>&bull;</span>
                <span>
                  Clip: <strong className="text-cz-ember font-bold">{(trimEnd - trimStart).toFixed(1)}s</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Multi-Track Trimming & Caption Studio */}
          <div className="bg-cz-surface border border-cz-border rounded-xl p-4 shadow-xl space-y-4">
            {/* Track Header & Numeric Bounds */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cz-border/60 pb-3">
              <div className="flex items-center space-x-2">
                <Scissors className="w-4 h-4 text-cz-ember" />
                <h3 className="text-xs font-display tracking-wider text-cz-bone uppercase text-sm">
                  TIMELINE TRIMMING & BOUNDARIES
                </h3>
              </div>
              <div className="flex items-center space-x-3 text-xs font-mono">
                <label className="flex items-center space-x-1.5">
                  <span className="text-cz-muted">In:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={trimStart.toFixed(1)}
                    onChange={(e) => handleTrimStartChange(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-cz-base border border-cz-border rounded px-1.5 py-0.5 text-cz-bone text-xs text-center font-mono focus:border-cz-ember"
                  />
                  <span className="text-cz-muted">s</span>
                </label>
                <label className="flex items-center space-x-1.5">
                  <span className="text-cz-muted">Out:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={trimEnd.toFixed(1)}
                    onChange={(e) => handleTrimEndChange(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-cz-base border border-cz-border rounded px-1.5 py-0.5 text-cz-bone text-xs text-center font-mono focus:border-cz-ember"
                  />
                  <span className="text-cz-muted">s</span>
                </label>
              </div>
            </div>

            {/* Scrub Slider */}
            <div>
              <input
                type="range"
                min={trimStart}
                max={trimEnd}
                step="0.05"
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="w-full h-2.5 bg-cz-base rounded-lg appearance-none cursor-pointer accent-cz-ember"
              />
            </div>

            {/* Track 1: Caption Phrases */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-cz-muted mb-2">
                <span className="flex items-center space-x-1.5">
                  <Type className="w-3.5 h-3.5 text-cz-ember" />
                  <span>Phrases ({captions.length}) • Click phrase to edit text inline</span>
                </span>
                <button
                  type="button"
                  onClick={handleAddCaption}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded bg-cz-base hover:bg-cz-raised border border-cz-border text-cz-bone hover:text-cz-ember text-[11px] transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Phrase</span>
                </button>
              </div>

              <div className="bg-cz-base border border-cz-border rounded-lg p-2.5 min-h-[55px] flex items-center space-x-2 overflow-x-auto">
                {captions.length === 0 ? (
                  <span className="text-xs text-cz-muted italic px-2">No captions in this timeframe. Click 'Add Phrase' to create one.</span>
                ) : (
                  captions.map((cap) => {
                    const isSelected = selectedCaptionId === cap.id;
                    const isActive = currentTime >= cap.start && currentTime <= cap.end;
                    return (
                      <div
                        key={cap.id}
                        onClick={() => handleSelectCaption(cap)}
                        className={`cursor-pointer px-3 py-1.5 rounded border text-xs whitespace-nowrap transition-all flex items-center space-x-1.5 shrink-0 ${
                          isSelected
                            ? 'bg-cz-ember-subtle border-cz-ember text-cz-bone shadow-md'
                            : isActive
                            ? 'bg-cz-raised border-cz-border text-cz-ember font-semibold'
                            : 'bg-cz-surface border-cz-border text-cz-muted hover:text-cz-bone hover:border-cz-muted'
                        }`}
                      >
                        <span className="font-mono text-[10px] text-cz-muted">
                          {cap.start.toFixed(1)}s:
                        </span>
                        <span className="font-bold max-w-[130px] truncate">{cap.text}</span>
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCaption(cap.id);
                            }}
                            className="p-0.5 rounded hover:text-rose-400 text-cz-muted ml-1"
                            title="Delete phrase"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Track 2: Speaker Reframing Modes */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-cz-muted mb-2">
                <span className="flex items-center space-x-1.5">
                  <Crop className="w-3.5 h-3.5 text-cz-sensor" />
                  <span>Speaker Crop Mode</span>
                </span>
                <span className="text-[10px] font-mono text-cz-ember font-bold">
                  Active: {cropOverride.mode.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { mode: 'auto', label: 'AI Auto', icon: Sparkles },
                  { mode: 'center', label: 'Center', icon: User, cx: 0.5 },
                  { mode: 'left', label: 'Left', icon: Users, cx: 0.25 },
                  { mode: 'right', label: 'Right', icon: Users, cx: 0.75 },
                  { mode: 'blur', label: 'Blurred Fill', icon: Grid },
                  { mode: 'manual', label: 'Manual Drag', icon: Sliders, cx: activeCropCenterX },
                ].map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => handleSetCropMode(item.mode, item.cx ?? 0.5)}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                      cropOverride.mode === item.mode
                        ? 'bg-cz-ember-subtle border-cz-ember text-cz-ember shadow-sm'
                        : 'bg-cz-base border-cz-border text-cz-muted hover:text-cz-bone'
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Complete Font & Style Studio Panel */}
        <div className="space-y-5">
          {/* Active Phrase Text Editor */}
          <div className="bg-cz-surface border border-cz-border rounded-xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-display tracking-wider text-cz-bone uppercase flex items-center space-x-2">
              <Type className="w-4 h-4 text-cz-ember" />
              <span>EDIT SELECTED PHRASE</span>
            </h3>

            {selectedCaptionId ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-cz-muted uppercase tracking-wider mb-1.5 font-sans">
                    Caption Text
                  </label>
                  <textarea
                    rows={2}
                    value={editingCaptionText}
                    onChange={(e) => setEditingCaptionText(e.target.value)}
                    className="w-full bg-cz-base border border-cz-border rounded-lg px-3 py-2 text-xs text-cz-bone focus:outline-none focus:border-cz-ember font-sans leading-relaxed"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUpdateCaptionText}
                  className="w-full py-1.5 rounded bg-cz-raised hover:bg-cz-border border border-cz-border text-cz-bone text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Apply Text Changes
                </button>
              </div>
            ) : (
              <p className="text-xs text-cz-muted py-2 text-center italic font-sans">
                Click any phrase on the timeline to edit text directly.
              </p>
            )}
          </div>

          {/* Font Typography Studio */}
          <div className="bg-cz-surface border border-cz-border rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-cz-border/60 pb-2">
              <h3 className="text-xs font-display tracking-wider text-cz-bone uppercase flex items-center space-x-2">
                <Palette className="w-4 h-4 text-cz-ember" />
                <span>TYPOGRAPHY & FONT STYLES</span>
              </h3>
              <span className="text-[10px] font-mono text-cz-ember bg-cz-ember-subtle border border-cz-ember/40 px-1.5 py-0.5 rounded">
                LIVE OVERLAY
              </span>
            </div>

            {/* Visual Font Family Cards */}
            <div>
              <label className="block text-[11px] font-bold text-cz-muted uppercase tracking-wider mb-2 font-sans">
                Viral Font Family
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {FONTS.map((f) => {
                  const isSelected = style.font_name === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setStyle((s) => ({ ...s, font_name: f.id }));
                        markDirty();
                      }}
                      className={`w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cz-ember-subtle border-cz-ember text-cz-bone shadow-sm'
                          : 'bg-cz-base border-cz-border text-cz-muted hover:text-cz-bone hover:border-cz-muted'
                      }`}
                    >
                      <div>
                        <span style={f.style} className="text-sm block leading-none">
                          {f.name}
                        </span>
                        <span className="text-[10px] text-cz-muted font-sans mt-0.5 block">
                          {f.desc}
                        </span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-cz-ember shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Size Presets & Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-cz-muted uppercase tracking-wider font-sans">
                  Font Scale
                </label>
                <span className="text-xs font-mono font-bold text-cz-bone">
                  {style.font_size || 76}px
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {FONT_SIZES.map((sz) => (
                  <button
                    key={sz.label}
                    type="button"
                    onClick={() => {
                      setStyle((s) => ({ ...s, font_size: sz.val }));
                      markDirty();
                    }}
                    className={`py-1 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                      (style.font_size || 76) === sz.val
                        ? 'bg-cz-ember text-cz-base border-cz-ember font-bold'
                        : 'bg-cz-base border-cz-border text-cz-muted hover:text-cz-bone'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>

              <input
                type="range"
                min="48"
                max="112"
                step="4"
                value={style.font_size || 76}
                onChange={(e) => {
                  setStyle((s) => ({ ...s, font_size: parseInt(e.target.value, 10) }));
                  markDirty();
                }}
                className="w-full h-2 bg-cz-base rounded-lg appearance-none cursor-pointer accent-cz-ember"
              />
            </div>

            {/* Text Case Selector */}
            <div>
              <label className="block text-[11px] font-bold text-cz-muted uppercase tracking-wider mb-1.5 font-sans">
                Text Transform
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'uppercase', label: 'UPPERCASE' },
                  { id: 'capitalize', label: 'Title Case' },
                  { id: 'normal', label: 'Natural' },
                ].map((tc) => (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => {
                      setStyle((s) => ({ ...s, text_case: tc.id }));
                      markDirty();
                    }}
                    className={`py-1.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                      (style.text_case || 'uppercase') === tc.id
                        ? 'bg-cz-raised border-cz-ember text-cz-ember'
                        : 'bg-cz-base border-cz-border text-cz-muted hover:text-cz-bone'
                    }`}
                  >
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Highlight Accent Color */}
            <div>
              <label className="block text-[11px] font-bold text-cz-muted uppercase tracking-wider mb-2 font-sans">
                Active Highlight Color
              </label>
              <div className="flex flex-wrap gap-2">
                {HIGHLIGHT_COLORS.map((c) => {
                  const isSelected = style.highlight_color === c.val;
                  return (
                    <button
                      key={c.val}
                      type="button"
                      onClick={() => {
                        setStyle((s) => ({ ...s, highlight_color: c.val }));
                        markDirty();
                      }}
                      className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  );
                })}
              </div>
            </div>

            {/* Animation Preset */}
            <div>
              <label className="block text-[11px] font-bold text-cz-muted uppercase tracking-wider mb-1.5 font-sans">
                Animation Dynamic
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStyle((s) => ({ ...s, preset: 'karaoke' }));
                    markDirty();
                  }}
                  className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    style.preset === 'karaoke'
                      ? 'bg-cz-ember-subtle border-cz-ember text-cz-ember'
                      : 'bg-cz-base border-cz-border text-cz-muted hover:text-cz-bone'
                  }`}
                >
                  Line Karaoke
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStyle((s) => ({ ...s, preset: 'single' }));
                    markDirty();
                  }}
                  className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    style.preset === 'single'
                      ? 'bg-cz-ember-subtle border-cz-ember text-cz-ember'
                      : 'bg-cz-base border-cz-border text-cz-muted hover:text-cz-bone'
                  }`}
                >
                  Single Word Punch
                </button>
              </div>
            </div>

            {/* Vertical Position */}
            <div>
              <label className="block text-[11px] font-bold text-cz-muted uppercase tracking-wider mb-1.5 font-sans">
                Screen Position
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {['bottom', 'middle', 'top'].map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      setStyle((s) => ({ ...s, position: pos }));
                      markDirty();
                    }}
                    className={`py-1.5 rounded text-xs capitalize font-semibold border transition-all cursor-pointer ${
                      style.position === pos
                        ? 'bg-cz-raised border-cz-ember text-cz-ember'
                        : 'bg-cz-base border-cz-border text-cz-muted hover:text-cz-bone'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

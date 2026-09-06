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
} from 'lucide-react';

const PRESET_COLORS = [
  { name: 'Yellow', val: 'yellow', hex: '#FFFF00' },
  { name: 'Cyan', val: 'cyan', hex: '#00FFFF' },
  { name: 'Green', val: 'green', hex: '#00FF00' },
  { name: 'Gold', val: 'gold', hex: '#FFD700' },
  { name: 'White', val: 'white', hex: '#FFFFFF' },
  { name: 'Red', val: 'red', hex: '#FF3B30' },
  { name: 'Magenta', val: 'magenta', hex: '#FF2D55' },
];

const FONTS = ['Arial', 'Montserrat', 'Impact', 'Trebuchet MS', 'Helvetica'];

export default function EditorScreen({ clip, onBack, onClipUpdated }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorData, setEditorData] = useState(null);

  // Playback state
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [viewMode, setViewMode] = useState('canvas'); // 'canvas' (16:9 with crop box) or 'crop' (9:16)

  // Edit states (dirty tracking)
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [captions, setCaptions] = useState([]);
  const [selectedCaptionId, setSelectedCaptionId] = useState(null);
  const [editingCaptionText, setEditingCaptionText] = useState('');
  const [cropOverride, setCropOverride] = useState({ mode: 'auto', center_x: 0.5 });
  const [style, setStyle] = useState({
    preset: 'karaoke',
    font_name: 'Arial',
    highlight_color: 'yellow',
    position: 'bottom',
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderMessage, setRenderMessage] = useState('');

  // Dragging states
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const timelineRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Load editor data on mount or clip change
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

  // Video time tracking
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    // Loop within trim bounds
    if (t >= trimEnd) {
      videoRef.current.currentTime = trimStart;
      if (!isPlaying) {
        videoRef.current.pause();
      }
    } else if (t < trimStart - 0.2) {
      videoRef.current.currentTime = trimStart;
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoRef.current.currentTime >= trimEnd || videoRef.current.currentTime < trimStart) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const seekTo = (t) => {
    const clamped = Math.max(trimStart, Math.min(trimEnd, t));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    setCurrentTime(clamped);
  };

  // Mark dirty on any edit change
  const markDirty = () => {
    setHasUnsavedChanges(true);
  };

  // Trim handle changes
  const handleTrimStartChange = (newVal) => {
    const val = Math.max(0, Math.min(trimEnd - 1.0, newVal));
    setTrimStart(val);
    markDirty();
    if (currentTime < val) seekTo(val);
  };

  const handleTrimEndChange = (newVal) => {
    const maxBound = videoDuration > 0 ? videoDuration : 3600;
    const val = Math.min(maxBound, Math.max(trimStart + 1.0, newVal));
    setTrimEnd(val);
    markDirty();
    if (currentTime > val) seekTo(trimStart);
  };

  // Crop override logic
  const activeCropCenterX = useMemo(() => {
    if (cropOverride.mode === 'center') return 0.5;
    if (cropOverride.mode === 'left') return 0.25;
    if (cropOverride.mode === 'right') return 0.75;
    if (cropOverride.mode === 'manual') return cropOverride.center_x ?? 0.5;

    // 'auto': find nearest point in crop_path for relative time
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

  // Interactive 9:16 box drag on video
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

  // Caption inline edit
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

  // Active caption at current timestamp
  const currentActiveCaption = useMemo(() => {
    return captions.find((c) => currentTime >= c.start && currentTime <= c.end);
  }, [captions, currentTime]);

  // Save edits draft
  const handleSaveDraft = async () => {
    if (!clip?.id) return;
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
      if (!res.ok) throw new Error('Failed to save draft edits.');
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err.message || 'Error saving edits draft.');
    } finally {
      setIsSaving(false);
    }
  };

  // Rerender Short with full-res source
  const handleTriggerRerender = async () => {
    if (!clip?.id) return;
    setIsRendering(true);
    setError('');
    setRenderMessage('Starting pipeline re-render (crop, subtitles, export)...');

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

      if (!res.ok) throw new Error('Failed to trigger re-render');

      setHasUnsavedChanges(false);
      startPollingRender(clip.id);
    } catch (err) {
      setError(err.message || 'Failed to start re-rendering.');
      setIsRendering(false);
    }
  };

  const startPollingRender = (clipId) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/clips/${clipId}`);
        if (!res.ok) return;
        const updated = await res.json();

        if (updated.render_status === 'idle') {
          clearInterval(pollingIntervalRef.current);
          setIsRendering(false);
          setRenderMessage('Re-render complete! New video ready.');
          if (onClipUpdated) onClipUpdated(updated);
          // Reload editor data to sync video file
          loadEditorData(clipId);
          setTimeout(() => setRenderMessage(''), 4000);
        } else if (updated.render_status === 'failed') {
          clearInterval(pollingIntervalRef.current);
          setIsRendering(false);
          setError(updated.render_error || 'Re-rendering failed.');
        } else {
          setRenderMessage('Rendering 1080x1920 full-res short with updated filters...');
        }
      } catch (e) {
        console.error('Render polling error:', e);
      }
    }, 1500);
  };

  const formatSeconds = (sec) => {
    if (!sec && sec !== 0) return '00:00.0';
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m.toString().padStart(2, '0')}:${s.padStart(4, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-slate-400">
        <Loader2 className="w-9 h-9 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-medium">Loading 480p Proxy & Timeline Editor...</p>
      </div>
    );
  }

  // 9:16 width inside 16:9 is (9/16)/(16/9) = 31.64%
  const cropBoxWidthPercent = 31.64;
  const cropBoxLeftPercent = Math.max(
    0,
    Math.min(100 - cropBoxWidthPercent, (activeCropCenterX - cropBoxWidthPercent / 200) * 100)
  );

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="Back to Shorts"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-white line-clamp-1">
                {clip?.title || 'Edit Short'}
              </h2>
              {/* Unsaved vs Baked Status Badge */}
              {isRendering ? (
                <span className="flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Rendering...</span>
                </span>
              ) : hasUnsavedChanges ? (
                <span className="flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Unsaved changes</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Saved & Baked</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Scrubbing via 480p proxy &bull; Re-renders use 1080p full-res source
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleSaveDraft}
            disabled={isSaving || isRendering || !hasUnsavedChanges}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center space-x-1.5 disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Draft</span>
          </button>

          <button
            onClick={handleTriggerRerender}
            disabled={isRendering}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isRendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Baking Short...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Bake & Rerender Short</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {renderMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs flex items-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-sky-400" />
          <span>{renderMessage}</span>
        </div>
      )}

      {/* Main Grid: Left Video Player & Timeline / Right Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Video Player + Controls + Timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <FilmIcon />
                <span>480p Responsive Proxy Preview</span>
              </span>

              {/* View Mode Toggle */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setViewMode('canvas')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    viewMode === 'canvas'
                      ? 'bg-slate-800 text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Full Frame + Crop
                </button>
                <button
                  onClick={() => setViewMode('crop')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    viewMode === 'crop'
                      ? 'bg-slate-800 text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  9:16 Cropped
                </button>
              </div>
            </div>

            {/* Video Canvas / Crop Area */}
            <div
              className={`relative bg-black rounded-xl overflow-hidden select-none ${
                viewMode === 'canvas' ? 'aspect-video w-full' : 'aspect-[9/16] max-w-xs mx-auto'
              }`}
              onMouseMove={viewMode === 'canvas' ? handleCropMouseMove : undefined}
              onMouseUp={viewMode === 'canvas' ? handleCropMouseUp : undefined}
              onMouseLeave={viewMode === 'canvas' ? handleCropMouseUp : undefined}
            >
              <video
                ref={videoRef}
                src={editorData?.proxy_url || clip?.video_url}
                className={`w-full h-full object-cover ${
                  viewMode === 'crop' ? 'scale-[1.78]' : ''
                }`}
                style={
                  viewMode === 'crop'
                    ? {
                        transformOrigin: `${activeCropCenterX * 100}% center`,
                      }
                    : undefined
                }
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
                playsInline
              />

              {/* Interactive 9:16 Crop Overlay Box (when in canvas mode) */}
              {viewMode === 'canvas' && cropOverride.mode !== 'blur' && (
                <div
                  onMouseDown={handleCropOverlayMouseDown}
                  style={{
                    left: `${cropBoxLeftPercent}%`,
                    width: `${cropBoxWidthPercent}%`,
                  }}
                  className={`absolute top-0 bottom-0 border-2 border-emerald-400 bg-emerald-500/10 cursor-ew-resize transition-all ${
                    isDraggingCrop ? 'border-dashed bg-emerald-500/20' : ''
                  }`}
                >
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 font-bold border border-emerald-500/30 pointer-events-none whitespace-nowrap shadow">
                    9:16 Crop ({Math.round(activeCropCenterX * 100)}%)
                  </div>
                  {/* Subtle vertical center grid guide */}
                  <div className="w-px h-full bg-emerald-400/30 mx-auto pointer-events-none"></div>
                </div>
              )}

              {/* Blurred background badge */}
              {cropOverride.mode === 'blur' && (
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-semibold text-amber-400 border border-amber-500/30">
                  Blurred Fill Overlay Active
                </div>
              )}

              {/* Live Subtitle Overlay Preview */}
              {currentActiveCaption && (
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
                      fontFamily: style.font_name,
                      textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)',
                    }}
                    className={`inline-block px-3 py-1 font-extrabold uppercase rounded ${
                      style.preset === 'single'
                        ? 'text-2xl sm:text-3xl text-yellow-300 scale-105 transition-transform'
                        : 'text-lg sm:text-xl text-white'
                    }`}
                  >
                    <span style={{ color: PRESET_COLORS.find((c) => c.val === style.highlight_color)?.hex || '#FFFF00' }}>
                      {currentActiveCaption.text}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Playback Controls & Time Readout */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800 text-xs">
              <div className="flex items-center space-x-2">
                <button
                  onClick={togglePlay}
                  className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-md shadow-emerald-600/20"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => seekTo(trimStart)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Rewind to trim start"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-3 font-mono text-slate-300">
                <span>
                  Current: <strong className="text-white">{formatSeconds(currentTime)}</strong>
                </span>
                <span className="text-slate-600">&bull;</span>
                <span>
                  Clip Duration:{' '}
                  <strong className="text-emerald-400">
                    {(trimEnd - trimStart).toFixed(1)}s
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Multi-Track Timeline */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Timeline Tracks & Boundary Trimming
              </h3>
              <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
                <label className="flex items-center space-x-1">
                  <span>Start:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={trimStart.toFixed(1)}
                    onChange={(e) => handleTrimStartChange(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-white font-mono text-xs text-center"
                  />
                </label>
                <label className="flex items-center space-x-1">
                  <span>End:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={trimEnd.toFixed(1)}
                    onChange={(e) => handleTrimEndChange(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-white font-mono text-xs text-center"
                  />
                </label>
              </div>
            </div>

            {/* Scrub Bar / Ruler */}
            <div className="relative">
              <input
                type="range"
                min={trimStart}
                max={trimEnd}
                step="0.05"
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            {/* Track 1: Caption Track */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                <span className="flex items-center space-x-1">
                  <Type className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Caption Track (Click to edit text inline)</span>
                </span>
                <span className="text-[10px] text-slate-500">{captions.length} phrases</span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 min-h-[50px] flex items-center space-x-2 overflow-x-auto">
                {captions.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">No caption segments detected in this range</span>
                ) : (
                  captions.map((cap) => {
                    const isSelected = selectedCaptionId === cap.id;
                    const isActive = currentTime >= cap.start && currentTime <= cap.end;
                    return (
                      <div
                        key={cap.id}
                        onClick={() => handleSelectCaption(cap)}
                        className={`cursor-pointer px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md shadow-emerald-500/10'
                            : isActive
                            ? 'bg-slate-800 border-slate-600 text-emerald-300'
                            : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-mono text-[10px] opacity-75">
                          {cap.start.toFixed(1)}s:
                        </span>
                        <span className="font-medium max-w-[120px] truncate">{cap.text}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Track 2: Crop-Focus Track & Quick Overrides */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                <span className="flex items-center space-x-1">
                  <Crop className="w-3.5 h-3.5 text-sky-400" />
                  <span>Crop Focus Track (Speaker Positioning)</span>
                </span>
                <span className="text-[10px] font-mono text-sky-400">
                  Active Mode: {cropOverride.mode}
                </span>
              </div>

              {/* Quick Crop Override Buttons */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <button
                  type="button"
                  onClick={() => handleSetCropMode('auto')}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center space-x-1 ${
                    cropOverride.mode === 'auto'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI Auto</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCropMode('center', 0.5)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center space-x-1 ${
                    cropOverride.mode === 'center'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>Center</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCropMode('left', 0.25)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center space-x-1 ${
                    cropOverride.mode === 'left'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Left Speaker</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCropMode('right', 0.75)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center space-x-1 ${
                    cropOverride.mode === 'right'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Right Speaker</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCropMode('blur')}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center space-x-1 ${
                    cropOverride.mode === 'blur'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Grid className="w-3 h-3" />
                  <span>Blurred Fill</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCropMode('manual', activeCropCenterX)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center space-x-1 ${
                    cropOverride.mode === 'manual'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Manual Drag</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Style & Active Caption Inspector Panel */}
        <div className="space-y-4">
          {/* Active Caption Editor */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Type className="w-4 h-4 text-emerald-400" />
              <span>Selected Caption Block</span>
            </h3>

            {selectedCaptionId ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Edit Caption Text
                  </label>
                  <textarea
                    rows={2}
                    value={editingCaptionText}
                    onChange={(e) => setEditingCaptionText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUpdateCaptionText}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                >
                  Apply Text Changes
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3 text-center italic">
                Click any caption block on the timeline above to edit its text.
              </p>
            )}
          </div>

          {/* Subtitle Style Panel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Palette className="w-4 h-4 text-emerald-400" />
              <span>Caption Styling</span>
            </h3>

            {/* Preset Switcher */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Animation Preset
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStyle((s) => ({ ...s, preset: 'karaoke' }));
                    markDirty();
                  }}
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                    style.preset === 'karaoke'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Karaoke (Line Highlight)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStyle((s) => ({ ...s, preset: 'single' }));
                    markDirty();
                  }}
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                    style.preset === 'single'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Single Word (Pop-up)
                </button>
              </div>
            </div>

            {/* Color Swatches */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Highlight Accent Color
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => {
                  const isSelected = style.highlight_color === c.val;
                  return (
                    <button
                      key={c.val}
                      type="button"
                      onClick={() => {
                        setStyle((s) => ({ ...s, highlight_color: c.val }));
                        markDirty();
                      }}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        isSelected ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  );
                })}
              </div>
            </div>

            {/* Font Family */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Font Family
              </label>
              <select
                value={style.font_name}
                onChange={(e) => {
                  setStyle((s) => ({ ...s, font_name: e.target.value }));
                  markDirty();
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Vertical Position */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Vertical Screen Position
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['bottom', 'middle', 'top'].map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      setStyle((s) => ({ ...s, position: pos }));
                      markDirty();
                    }}
                    className={`py-1.5 rounded-lg border text-xs capitalize font-medium transition-all ${
                      style.position === pos
                        ? 'bg-slate-800 border-emerald-400 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
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

function FilmIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  );
}

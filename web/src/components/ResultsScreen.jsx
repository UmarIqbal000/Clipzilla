import React, { useState } from 'react';
import {
  Film,
  Download,
  Clock,
  Sparkles,
  Scissors,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Play,
  Sliders,
  Tv,
  Disc,
  AlertCircle,
  Trash2,
  X,
  Maximize2,
} from 'lucide-react';
import { apiDelete } from '../api/client';
import EditorScreen from './EditorScreen';
import StatBlockRow from './StatBlockRow';

export default function ResultsScreen({
  clips = [],
  batchJob = null,
  onBackToHistory,
  onBackToHome,
  onRefresh,
  loading = false,
  onEditClip,
  onDeleteClip,
}) {
  const [brokenClipIds, setBrokenClipIds] = useState(new Set());
  const [deletingClipId, setDeletingClipId] = useState('');
  const [panelEditingClip, setPanelEditingClip] = useState(null);

  const handleVideoError = (clipId) => {
    setBrokenClipIds((prev) => {
      const next = new Set(prev);
      next.add(clipId);
      return next;
    });
  };

  const handleDeleteClip = async (e, clipId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this vertical short from vault?')) return;
    setDeletingClipId(clipId);
    try {
      await apiDelete(`/clips/${encodeURIComponent(clipId)}`);
      if (onDeleteClip) {
        onDeleteClip(clipId);
      }
    } catch (err) {
      alert(err.message || 'Error deleting clip');
    } finally {
      setDeletingClipId('');
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '00:00';
    const s = Math.round(seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Group clips by source video
  const groupedClips = clips.reduce((acc, clip) => {
    const key = clip.video_id || 'source_video';
    if (!acc[key]) {
      acc[key] = {
        video_id: clip.video_id,
        video_title: clip.video_title || `Source Video [${clip.video_id}]`,
        source_url: clip.source_url,
        clips: [],
      };
    }
    acc[key].clips.push(clip);
    return acc;
  }, {});

  const groups = Object.values(groupedClips);

  // Calculate batch metrics for StatBlockRow
  const totalClipsCount = clips.length;
  const totalSeconds = clips.reduce((acc, c) => acc + (c.duration || 0), 0);
  const formattedTotalTime = `${Math.floor(totalSeconds / 60)}m ${Math.round(totalSeconds % 60)}s`;
  const exportPresetLabel = clips[0]?.export_preset
    ? clips[0].export_preset.replace('_', ' ')
    : '9:16 vertical';

  const batchStats = [
    { label: 'Shorts Spooled', value: totalClipsCount, hint: 'High-retention vertical cuts' },
    { label: 'Total Duration', value: formattedTotalTime, hint: 'Rendered celluloid' },
    { label: 'Source Feeds', value: groups.length, hint: 'Devoured long-form videos' },
    { label: 'Export Ratio', value: '9:16', hint: exportPresetLabel.toUpperCase() },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-cz-ink">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={batchJob ? onBackToHistory : onBackToHome}
            className="p-2 bg-cz-parchment border-2 border-cz-ink text-cz-ink hover:bg-cz-paper transition-all cursor-pointer shadow-[2px_2px_0px_#18140F] active:translate-x-[1px] active:translate-y-[1px]"
            title={batchJob ? "Back to History Archive" : "Back to Ingestion Deck"}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-cz-ink uppercase leading-none">
                {batchJob ? (
                  <>
                    BATCH REELS <span className="font-serif italic font-normal text-cz-moss lowercase tracking-normal">spool</span>.
                  </>
                ) : (
                  <>
                    ALL SPOOLED <span className="font-serif italic font-normal text-cz-moss lowercase tracking-normal">vault</span>.
                  </>
                )}
              </h2>
              {clips.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 bg-cz-rust text-cz-paper border border-cz-ink font-bold tabular-nums">
                  {clips.length} {clips.length === 1 ? 'reel' : 'reels'}
                </span>
              )}
            </div>
            <p className="text-xs text-cz-ink/70 font-sans mt-1">
              {batchJob
                ? `Rendered vertical shorts for batch: ${batchJob.video_title || batchJob.id}`
                : 'Master library of all vertical cuts generated across every video run'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-2 bg-cz-parchment border-2 border-cz-ink text-cz-ink hover:bg-cz-paper text-xs font-bold font-sans transition-all disabled:opacity-50 cursor-pointer shadow-[2px_2px_0px_#18140F]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cz-rust' : ''}`} />
              <span>Refresh vault</span>
            </button>
          )}
          <button
            type="button"
            onClick={onBackToHome}
            className="px-4 py-2 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper text-xs font-bold font-sans transition-all cursor-pointer border-2 border-cz-ink shadow-[2px_2px_0px_#18140F] active:translate-x-[1px] active:translate-y-[1px]"
          >
            + Devour new video
          </button>
        </div>
      </div>

      {/* Batch Summary Stat-Block Row */}
      {clips.length > 0 && <StatBlockRow stats={batchStats} />}

      {/* Empty State */}
      {clips.length === 0 ? (
        <div className="text-center py-16 bg-cz-parchment border-2 border-cz-ink max-w-lg mx-auto p-8 relative shadow-[4px_4px_0px_#18140F]">
          <div className="w-16 h-16 bg-cz-paper border-2 border-cz-ink flex items-center justify-center mx-auto mb-4 text-cz-rust shadow-[2px_2px_0px_#18140F]">
            <Disc className="w-8 h-8 animate-reel-spin" />
          </div>

          <h3 className="font-display text-3xl sm:text-4xl tracking-tight text-cz-ink uppercase mb-2">
            REEL VAULT IS EMPTY
          </h3>
          <p className="text-xs sm:text-sm text-cz-ink/75 mb-6 font-sans leading-relaxed max-w-sm mx-auto">
            Clipzilla hasn't spooled any vertical reels yet. Feed a long-form YouTube URL to devour the footage and stamp out shorts.
          </p>

          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper font-sans font-bold text-base uppercase border-2 border-cz-ink shadow-[3px_3px_0px_#18140F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#18140F] transition-all cursor-pointer"
          >
            <Film className="w-4 h-4" />
            <span>Feed the monster</span>
          </button>
        </div>
      ) : (
        /* Populated Video Groups */
        <div className="space-y-10">
          {groups.map((group, gIdx) => (
            <div key={group.video_id || gIdx} className="space-y-4">
              {/* Canister Group Header */}
              <div className="flex items-center justify-between bg-cz-paper border-2 border-cz-ink px-4 py-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-7 h-7 bg-cz-parchment border border-cz-ink flex items-center justify-center text-cz-rust shrink-0 font-bold">
                    <Tv className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-cz-ink truncate max-w-lg font-sans">
                      {group.video_title}
                    </h3>
                    <div className="flex items-center space-x-2 text-[11px] text-cz-ink/70 mt-0.5 font-sans">
                      <span className="font-semibold">Reel ID: {group.video_id}</span>
                      {group.source_url && (
                        <>
                          <span>&bull;</span>
                          <a
                            href={group.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cz-rust hover:underline font-bold flex items-center space-x-1"
                          >
                            <span>Original YouTube</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-xs px-2.5 py-1 bg-cz-parchment text-cz-ink font-bold border border-cz-ink shrink-0 tabular-nums">
                  {group.clips.length} {group.clips.length === 1 ? 'short' : 'shorts'}
                </span>
              </div>

              {/* 9:16 Vertical Filmstrip Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.clips.map((clip) => (
                  <div
                    key={clip.id}
                    className="bg-cz-parchment border-2 border-cz-ink flex flex-col hover:border-cz-rust transition-all relative group shadow-[3px_3px_0px_#18140F]"
                  >
                    {/* 9:16 Vertical Video Player */}
                    <div className="relative aspect-[9/16] bg-cz-ink w-full overflow-hidden border-b-2 border-cz-ink">
                      {brokenClipIds.has(clip.id) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-cz-paper text-cz-ink">
                          <div className="w-12 h-12 bg-cz-parchment border-2 border-cz-rust flex items-center justify-center text-cz-rust mb-3">
                            <AlertCircle className="w-6 h-6" />
                          </div>
                          <h4 className="font-display text-base tracking-wider text-cz-ink uppercase mb-1">
                            SOURCE FILE MISSING
                          </h4>
                          <p className="text-[11px] text-cz-ink/70 max-w-[200px] leading-relaxed mb-4 font-sans">
                            The rendered short was purged or moved from disk.
                          </p>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClip(e, clip.id)}
                            disabled={deletingClipId === clip.id}
                            className="px-3 py-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper text-cz-rust border-2 border-cz-rust text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove from vault</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <video
                            src={clip.video_url}
                            poster={clip.thumbnail_url || undefined}
                            controls
                            playsInline
                            preload="metadata"
                            onError={() => handleVideoError(clip.id)}
                            className="w-full h-full object-contain bg-black"
                          />

                          {/* Stamped Duration Badge */}
                          <div className="absolute top-2.5 right-2.5 bg-cz-paper px-2 py-0.5 text-[11px] font-sans font-bold text-cz-ink flex items-center space-x-1.5 border-2 border-cz-ink pointer-events-none tabular-nums shadow-[1px_1px_0px_#18140F]">
                            <span className="w-1.5 h-1.5 rounded-full bg-cz-rust" />
                            <span>{formatDuration(clip.duration)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Card Metadata & Actions */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3 font-sans">
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm text-cz-ink line-clamp-2 leading-snug">
                          {clip.title}
                        </h3>

                        {clip.reason && (
                          <div className="p-2.5 bg-cz-paper border border-cz-ink/30">
                            <div className="flex items-center space-x-1 text-[11px] font-bold text-cz-ink uppercase tracking-wider mb-1">
                              <Sparkles className="w-3 h-3 text-cz-rust" />
                              <span>Hook Narrative</span>
                            </div>
                            <p className="text-[11px] text-cz-ink/75 line-clamp-3 leading-relaxed">
                              {clip.reason}
                            </p>
                          </div>
                        )}

                        {Boolean(clip.needs_trimming) && clip.trimming_notes && (
                          <div className="p-2 bg-cz-paper border border-cz-rust text-cz-rust text-xs flex items-start space-x-1.5">
                            <Scissors className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cz-rust" />
                            <div>
                              <span className="font-bold">Trimming Note:</span>{' '}
                              <span>{clip.trimming_notes}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Controls */}
                      <div className="pt-2 border-t border-cz-ink/20 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setPanelEditingClip(clip)}
                          disabled={brokenClipIds.has(clip.id)}
                          className="px-3 py-2 bg-cz-paper hover:bg-cz-parchment text-cz-ink hover:text-cz-rust border-2 border-cz-ink transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-30 text-xs font-bold"
                          title="Edit Typography & Crop Directly on Panel"
                        >
                          <Sliders className="w-3.5 h-3.5 text-cz-rust" />
                          <span>Edit</span>
                        </button>
                        <a
                          href={clip.video_url}
                          download={`${clip.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                          className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all border-2 border-cz-ink ${
                            brokenClipIds.has(clip.id)
                              ? 'bg-cz-paper text-cz-muted cursor-not-allowed pointer-events-none'
                              : 'bg-cz-rust hover:bg-cz-rust-hover text-cz-paper shadow-[2px_2px_0px_#18140F] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download reel</span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClip(e, clip.id)}
                          disabled={deletingClipId === clip.id}
                          className="p-2 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper text-cz-ink border-2 border-cz-ink transition-colors cursor-pointer"
                          title="Delete Reel from Vault"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* In-Panel Reel Studio Modal / Drawer */}
      {panelEditingClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-cz-ink/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-cz-paper border-2 border-cz-ink w-full max-w-6xl max-h-[94vh] overflow-y-auto shadow-[6px_6px_0px_#18140F] flex flex-col relative my-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-cz-parchment border-b-2 border-cz-ink sticky top-0 z-30">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 bg-cz-paper border border-cz-ink flex items-center justify-center shrink-0 overflow-hidden">
                  <img src="/logo.png" alt="Clipzilla" className="w-full h-full object-cover select-none" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-display tracking-wider uppercase text-cz-ink truncate">
                    IN-PANEL STUDIO: {panelEditingClip.title}
                  </h3>
                  <p className="text-[11px] text-cz-ink/70 font-sans truncate">
                    Live font picker, boundary trimming, speaker crop & re-render
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {onEditClip && (
                  <button
                    type="button"
                    onClick={() => {
                      const c = panelEditingClip;
                      setPanelEditingClip(null);
                      onEditClip(c);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-cz-paper hover:bg-cz-parchment border-2 border-cz-ink text-xs font-bold text-cz-ink transition-colors cursor-pointer"
                    title="Open in Dedicated Full Studio Tab"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-cz-rust" />
                    <span className="hidden sm:inline">Open full tab</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPanelEditingClip(null)}
                  className="p-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-ink text-cz-ink transition-colors cursor-pointer"
                  title="Close In-Panel Studio"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Embedded Studio Deck */}
            <div className="p-4 sm:p-6 bg-cz-paper">
              <EditorScreen
                clip={panelEditingClip}
                onBack={() => setPanelEditingClip(null)}
                onClipUpdated={(updated) => {
                  setPanelEditingClip(updated);
                  if (onRefresh) onRefresh();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

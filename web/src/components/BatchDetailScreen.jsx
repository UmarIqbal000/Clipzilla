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
  Sliders,
  Tv,
  Disc,
  AlertCircle,
  Trash2,
  Send,
} from 'lucide-react';
import { apiDelete } from '../api/client';
import StatBlockRow from './StatBlockRow';
import PublishModal from './PublishModal';

export default function BatchDetailScreen({
  job,
  clips = [],
  onBackToHistory,
  onRefresh,
  loading = false,
  onEditClip,
  onDeleteClip,
}) {
  const [brokenClipIds, setBrokenClipIds] = useState(new Set());
  const [deletingClipId, setDeletingClipId] = useState('');
  const [publishingClip, setPublishingClip] = useState(null);

  const handleVideoError = (clipId) => {
    setBrokenClipIds((prev) => {
      const next = new Set(prev);
      next.add(clipId);
      return next;
    });
  };

  const handleDeleteClip = async (e, clipId) => {
    e.stopPropagation();
    if (!window.confirm('Remove this vertical short from the batch?')) return;
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

  // Metrics calculation
  const totalClipsCount = clips.length;
  const totalSeconds = clips.reduce((acc, c) => acc + (c.duration || 0), 0);
  const formattedTotalTime = `${Math.floor(totalSeconds / 60)}m ${Math.round(totalSeconds % 60)}s`;
  const exportPresetLabel = job?.export_preset
    ? job.export_preset.replace('_', ' ')
    : clips[0]?.export_preset
    ? clips[0].export_preset.replace('_', ' ')
    : 'youtube shorts';

  const batchStats = [
    { label: 'Batch Shorts', value: totalClipsCount, hint: 'Spooled vertical cuts' },
    { label: 'Batch Duration', value: formattedTotalTime, hint: 'Rendered celluloid' },
    { label: 'Export Ratio', value: '9:16', hint: exportPresetLabel.toUpperCase() },
    { label: 'Status', value: job?.status ? job.status.toUpperCase() : 'COMPLETED', hint: 'Pipeline ingestion' },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 font-sans">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-cz-ink">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={onBackToHistory}
            className="p-2.5 bg-cz-parchment border-2 border-cz-ink text-cz-ink hover:bg-cz-paper transition-all cursor-pointer shadow-[2px_2px_0px_#18140F] active:translate-x-[1px] active:translate-y-[1px] flex items-center space-x-2 text-xs font-bold"
            title="Back to History Archive"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to History</span>
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-cz-paper border border-cz-ink text-cz-ink">
                Batch Run {job?.id ? `#${job.id.slice(0, 8)}` : ''}
              </span>
              {clips.length > 0 && (
                <span className="text-xs px-2 py-0.5 bg-cz-rust text-cz-paper border border-cz-ink font-bold tabular-nums">
                  {clips.length} {clips.length === 1 ? 'short' : 'shorts'}
                </span>
              )}
            </div>
            <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-cz-ink uppercase leading-none mt-1">
              BATCH REELS <span className="font-serif italic font-normal text-cz-moss lowercase tracking-normal">spool</span>.
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-2 bg-cz-parchment border-2 border-cz-ink text-cz-ink hover:bg-cz-paper transition-colors disabled:opacity-50 text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-[2px_2px_0px_#18140F]"
              title="Refresh Batch Shorts"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cz-rust' : ''}`} />
              <span>Refresh Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* Batch Source Video Ledger Banner */}
      <div className="bg-cz-paper border-2 border-cz-ink p-4 sm:p-5 mb-6 shadow-[3px_3px_0px_#18140F]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5 min-w-0 flex-1">
            <div className="w-10 h-10 bg-cz-parchment border-2 border-cz-ink flex items-center justify-center text-cz-rust shrink-0 shadow-[1px_1px_0px_#18140F]">
              <Tv className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-cz-moss text-cz-paper border border-cz-ink">
                  {job?.status || 'Done'}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-cz-parchment border border-cz-ink text-cz-ink">
                  {exportPresetLabel}
                </span>
                {job?.created_at && (
                  <span className="text-[11px] text-cz-ink/70">
                    Ingested: {new Date(job.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-cz-ink font-sans truncate">
                {job?.video_title || (clips[0]?.video_title) || 'Source Video'}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-cz-ink/70 mt-1">
                {(job?.video_id || clips[0]?.video_id) && (
                  <span>Reel ID: <code className="font-bold text-cz-ink">{job?.video_id || clips[0]?.video_id}</code></span>
                )}
                {(job?.url || clips[0]?.source_url) && (
                  <>
                    <span>&bull;</span>
                    <a
                      href={job?.url || clips[0]?.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cz-rust hover:underline font-bold flex items-center space-x-1"
                    >
                      <span>Watch Source on YouTube</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center space-x-3 border-t md:border-t-0 md:border-l-2 md:border-cz-ink/20 pt-3 md:pt-0 md:pl-5">
            <div className="text-left md:text-right">
              <span className="text-[11px] text-cz-ink/60 uppercase font-bold block">Batch Vault</span>
              <span className="text-xl font-display text-cz-ink">
                {totalClipsCount} {totalClipsCount === 1 ? 'SHORT' : 'SHORTS'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Block Row */}
      {clips.length > 0 && <StatBlockRow stats={batchStats} />}

      {/* Shorts Header */}
      <div className="flex items-center justify-between mt-8 mb-4 pb-2 border-b border-cz-ink/30">
        <div>
          <h3 className="font-display text-2xl sm:text-3xl tracking-tight text-cz-ink uppercase">
            YOUTUBE SHORTS IN THIS BATCH
          </h3>
          <p className="text-xs text-cz-ink/70">
            All high-retention 9:16 vertical cuts rendered from this footage
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-cz-parchment text-cz-ink font-bold border border-cz-ink tabular-nums">
          {clips.length} {clips.length === 1 ? 'video' : 'videos'}
        </span>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-16 bg-cz-parchment border-2 border-cz-ink max-w-md mx-auto p-8 shadow-[4px_4px_0px_#18140F]">
          <Disc className="w-8 h-8 text-cz-rust animate-reel-spin mx-auto mb-3" />
          <h4 className="font-display text-xl uppercase tracking-wider text-cz-ink mb-1">
            LOADING BATCH SHORTS...
          </h4>
          <p className="text-xs text-cz-ink/70">Retrieving vertical celluloid cuts from vault</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && clips.length === 0 && (
        <div className="text-center py-16 bg-cz-parchment border-2 border-cz-ink max-w-lg mx-auto p-8 shadow-[4px_4px_0px_#18140F]">
          <div className="w-14 h-14 bg-cz-paper border-2 border-cz-ink flex items-center justify-center mx-auto mb-3 text-cz-rust">
            <Film className="w-7 h-7" />
          </div>
          <h4 className="font-display text-2xl uppercase tracking-wider text-cz-ink mb-2">
            NO SHORTS FOUND FOR THIS BATCH
          </h4>
          <p className="text-xs text-cz-ink/70 mb-5 leading-relaxed">
            This batch run did not produce any vertical reels or they may have been deleted.
          </p>
          <button
            type="button"
            onClick={onBackToHistory}
            className="px-5 py-2.5 bg-cz-rust text-cz-paper font-bold text-xs uppercase border-2 border-cz-ink shadow-[2px_2px_0px_#18140F] hover:bg-cz-rust-hover cursor-pointer"
          >
            ← Return to History Archive
          </button>
        </div>
      )}

      {/* 9:16 Vertical Shorts Grid */}
      {!loading && clips.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {clips.map((clip, idx) => (
            <div
              key={clip.id || idx}
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
                    <p className="text-[11px] text-cz-ink/70 max-w-[200px] leading-relaxed mb-4">
                      The rendered short was purged or moved from disk.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClip(e, clip.id)}
                      disabled={deletingClipId === clip.id}
                      className="px-3 py-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper text-cz-rust border-2 border-cz-rust text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove from batch</span>
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

                    {/* Duration Badge */}
                    <div className="absolute top-2.5 right-2.5 bg-cz-paper px-2 py-0.5 text-[11px] font-sans font-bold text-cz-ink flex items-center space-x-1.5 border-2 border-cz-ink pointer-events-none tabular-nums shadow-[1px_1px_0px_#18140F]">
                      <span className="w-1.5 h-1.5 rounded-full bg-cz-rust" />
                      <span>{formatDuration(clip.duration)}</span>
                    </div>

                    {/* Short Index Pill */}
                    <div className="absolute top-2.5 left-2.5 bg-cz-paper px-2 py-0.5 text-[10px] font-sans font-bold text-cz-ink border-2 border-cz-ink pointer-events-none uppercase shadow-[1px_1px_0px_#18140F]">
                      Short #{idx + 1}
                    </div>
                  </>
                )}
              </div>

              {/* Card Details & Actions */}
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
                  {onEditClip && (
                    <button
                      type="button"
                      onClick={() => onEditClip(clip)}
                      disabled={brokenClipIds.has(clip.id)}
                      className="px-2.5 py-2 bg-cz-paper hover:bg-cz-parchment text-cz-ink hover:text-cz-rust border-2 border-cz-ink transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-30 text-xs font-bold"
                      title="Edit Short in Timeline Editor"
                    >
                      <Sliders className="w-3.5 h-3.5 text-cz-rust" />
                      <span>Edit</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPublishingClip(clip)}
                    disabled={brokenClipIds.has(clip.id)}
                    className="px-2.5 py-2 bg-cz-paper hover:bg-cz-parchment text-cz-ink hover:text-cz-moss border-2 border-cz-ink transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-30 text-xs font-bold shadow-[1px_1px_0px_#18140F]"
                    title="Publish Directly to Social Media"
                  >
                    <Send className="w-3.5 h-3.5 text-cz-moss" />
                    <span>Publish</span>
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
                    <span className="hidden sm:inline">Download</span>
                  </a>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteClip(e, clip.id)}
                    disabled={deletingClipId === clip.id}
                    className="p-2 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper text-cz-ink border-2 border-cz-ink transition-colors cursor-pointer"
                    title="Delete Short from Batch"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {publishingClip && (
        <PublishModal
          clip={publishingClip}
          onClose={() => setPublishingClip(null)}
          onPublished={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}

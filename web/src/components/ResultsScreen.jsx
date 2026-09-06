import React from 'react';
import { Film, Download, Clock, Sparkles, Scissors, ArrowLeft, RefreshCw, ExternalLink, Play, Sliders } from 'lucide-react';

export default function ResultsScreen({ clips = [], onBackToHome, onRefresh, loading = false, onEditClip }) {
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '0s';
    const s = Math.round(seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToHome}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="Back to generator"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <span>Viral Shorts Ready</span>
              {clips.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              High-retention vertical clips with speaker-tracked reframing and animated subtitles
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
          <button
            onClick={onBackToHome}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all"
          >
            + New Video
          </button>
        </div>
      </div>

      {/* Empty State */}
      {clips.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/40 border border-slate-800/80 rounded-2xl max-w-lg mx-auto p-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Film className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Shorts Generated Yet</h3>
          <p className="text-sm text-slate-400 mb-6">
            Paste a YouTube URL in the Create tab to let Clipzilla devour your video and produce viral shorts.
          </p>
          <button
            onClick={onBackToHome}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-green-400 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Shorts</span>
          </button>
        </div>
      ) : (
        /* Clips Grid: 9:16 vertical cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col hover:border-slate-700 transition-all duration-200"
            >
              {/* 9:16 Vertical Video Container */}
              <div className="relative aspect-[9/16] bg-black w-full overflow-hidden group">
                <video
                  src={clip.video_url}
                  poster={clip.thumbnail_url || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-contain bg-black"
                />

                {/* Duration Badge */}
                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-mono font-medium text-white flex items-center space-x-1 border border-white/10 pointer-events-none">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>{formatDuration(clip.duration)}</span>
                </div>
              </div>

              {/* Clip Metadata & Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <h3 className="font-bold text-base text-white line-clamp-2 leading-snug">
                    {clip.title}
                  </h3>

                  {clip.reason && (
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                      <div className="flex items-center space-x-1.5 text-xs font-medium text-emerald-400 mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Hook & Virality Reason</span>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                        {clip.reason}
                      </p>
                    </div>
                  )}

                  {Boolean(clip.needs_trimming) && clip.trimming_notes && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start space-x-1.5">
                      <Scissors className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <div>
                        <span className="font-semibold">Trimming Suggestion:</span>{' '}
                        <span>{clip.trimming_notes}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => onEditClip && onEditClip(clip)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 transition-colors flex items-center justify-center"
                    title="Open Timeline Editor & Refine"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={clip.video_url}
                    download={`${clip.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download MP4</span>
                  </a>
                  <a
                    href={clip.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

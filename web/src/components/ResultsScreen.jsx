import React from 'react';
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
} from 'lucide-react';

export default function ResultsScreen({
  clips = [],
  onBackToHome,
  onRefresh,
  loading = false,
  onEditClip,
}) {
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

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-5 border-b border-cz-border">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={onBackToHome}
            className="p-2 rounded bg-cz-surface border border-cz-border text-cz-muted hover:text-cz-bone hover:border-cz-ember transition-colors cursor-pointer"
            title="Back to Ingestion Deck"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-cz-bone uppercase leading-none">
                SPOOLED SHORTS VAULT
              </h2>
              {clips.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded bg-cz-base border border-cz-border text-cz-bone font-medium tabular-nums">
                  {clips.length} {clips.length === 1 ? 'reel' : 'reels'}
                </span>
              )}
            </div>
            <p className="text-xs text-cz-muted font-sans mt-1">
              High-retention 9:16 vertical cuts with neural speaker tracking and animated subtitles
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-cz-surface border border-cz-border text-cz-bone hover:border-cz-muted text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cz-ember' : ''}`} />
              <span>Refresh Vault</span>
            </button>
          )}
          <button
            type="button"
            onClick={onBackToHome}
            className="px-4 py-1.5 rounded bg-cz-ember hover:bg-cz-ember-hover text-cz-bone text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_2px_0_0_#9a2b05] active:translate-y-[1px]"
          >
            + Devour New Video
          </button>
        </div>
      </div>

      {/* Empty State (Creature Vault) */}
      {clips.length === 0 ? (
        <div className="text-center py-20 bg-cz-surface border border-cz-border rounded-lg max-w-lg mx-auto p-8 relative overflow-hidden shadow-2xl">
          <div className="h-1.5 w-full sprocket-track-h opacity-40 absolute top-0 left-0 border-b border-cz-border/40" />

          <div className="w-16 h-16 rounded-md bg-cz-base border border-cz-border flex items-center justify-center mx-auto mb-5 text-cz-muted">
            <Disc className="w-8 h-8 text-cz-ember animate-reel-spin" />
          </div>

          <h3 className="font-display text-3xl tracking-wide text-cz-bone uppercase mb-2">
            REEL VAULT IS EMPTY
          </h3>
          <p className="text-xs sm:text-sm text-cz-muted mb-7 font-sans leading-relaxed max-w-sm mx-auto">
            Clipzilla hasn't spooled any vertical reels yet. Feed a long-form YouTube URL to devour the footage and stamp out shorts.
          </p>

          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center space-x-2 px-6 py-3 rounded bg-cz-ember hover:bg-cz-ember-hover text-cz-bone font-display tracking-widest text-lg uppercase shadow-[0_3px_0_0_#9a2b05] active:translate-y-[2px] transition-all cursor-pointer"
          >
            <Film className="w-4 h-4" />
            <span>FEED THE MONSTER</span>
          </button>

          <div className="h-1.5 w-full sprocket-track-h opacity-40 absolute bottom-0 left-0 border-t border-cz-border/40" />
        </div>
      ) : (
        /* Populated Video Groups */
        <div className="space-y-10">
          {groups.map((group, gIdx) => (
            <div key={group.video_id || gIdx} className="space-y-5">
              {/* Canister Group Header */}
              <div className="flex items-center justify-between bg-cz-surface border border-cz-border px-4 py-3 rounded-md">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-7 h-7 rounded bg-cz-base border border-cz-border flex items-center justify-center text-cz-ember shrink-0">
                    <Tv className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-cz-bone truncate max-w-lg font-sans">
                      {group.video_title}
                    </h3>
                    <div className="flex items-center space-x-2 text-[11px] text-cz-muted mt-0.5">
                      <span className="tabular-nums font-medium">Reel ID: {group.video_id}</span>
                      {group.source_url && (
                        <>
                          <span>/</span>
                          <a
                            href={group.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cz-bone hover:text-cz-ember hover:underline flex items-center space-x-1"
                          >
                            <span>Original YouTube</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-xs px-2.5 py-1 rounded bg-cz-base text-cz-bone font-medium border border-cz-border shrink-0 tabular-nums">
                  {group.clips.length} {group.clips.length === 1 ? 'short' : 'shorts'}
                </span>
              </div>

              {/* 9:16 Vertical Filmstrip Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.clips.map((clip) => (
                  <div
                    key={clip.id}
                    className="bg-cz-surface border border-cz-border rounded-lg overflow-hidden shadow-xl flex flex-col hover:border-cz-muted/60 transition-all relative group"
                  >
                    {/* Top Sprocket Rail */}
                    <div className="h-1.5 w-full sprocket-track-h opacity-40 border-b border-cz-border/40" />

                    {/* 9:16 Vertical Video Player */}
                    <div className="relative aspect-[9/16] bg-cz-base w-full overflow-hidden">
                      <video
                        src={clip.video_url}
                        poster={clip.thumbnail_url || undefined}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain bg-black"
                      />

                      {/* Stamped Duration Badge */}
                      <div className="absolute top-2.5 right-2.5 bg-cz-base/90 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-sans font-semibold text-cz-bone flex items-center space-x-1.5 border border-cz-border pointer-events-none tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-cz-ember" />
                        <span>{formatDuration(clip.duration)}</span>
                      </div>
                    </div>

                    {/* Bottom Sprocket Rail */}
                    <div className="h-1.5 w-full sprocket-track-h opacity-40 border-t border-cz-border/40" />

                    {/* Card Metadata & Actions */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm text-cz-bone line-clamp-2 leading-snug font-sans">
                          {clip.title}
                        </h3>

                        {clip.reason && (
                          <div className="p-2.5 rounded bg-cz-base border border-cz-border">
                            <div className="flex items-center space-x-1 text-[11px] font-bold text-cz-bone uppercase tracking-wider mb-1">
                              <Sparkles className="w-3 h-3 text-cz-ember" />
                              <span>Hook Narrative</span>
                            </div>
                            <p className="text-[11px] text-cz-muted line-clamp-3 leading-relaxed font-sans">
                              {clip.reason}
                            </p>
                          </div>
                        )}

                        {Boolean(clip.needs_trimming) && clip.trimming_notes && (
                          <div className="p-2 rounded bg-cz-base border border-amber-900/60 text-amber-200 text-xs flex items-start space-x-1.5">
                            <Scissors className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cz-ember" />
                            <div>
                              <span className="font-bold">Trimming Note:</span>{' '}
                              <span>{clip.trimming_notes}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Controls */}
                      <div className="pt-2 border-t border-cz-border flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => onEditClip && onEditClip(clip)}
                          className="p-2 rounded bg-cz-base hover:bg-cz-raised text-cz-bone hover:text-cz-ember border border-cz-border transition-colors flex items-center justify-center cursor-pointer"
                          title="Open Timeline Editor"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={clip.video_url}
                          download={`${clip.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                          className="flex-1 py-2 px-3 rounded bg-cz-ember hover:bg-cz-ember-hover text-cz-bone text-xs font-bold tracking-wider uppercase flex items-center justify-center space-x-1.5 shadow-[0_2px_0_0_#9a2b05] active:translate-y-[1px] transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Reel</span>
                        </a>
                        <a
                          href={clip.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded bg-cz-base hover:bg-cz-raised text-cz-muted hover:text-cz-bone border border-cz-border transition-colors cursor-pointer"
                          title="Open Video Player"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  Film,
  Sliders,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  Disc,
  Tv,
} from 'lucide-react';
import { apiGet, apiDelete } from '../api/client';

export default function HistoryScreen({ onOpenJob, onOpenEditor, onNavigateToCreate }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isConnError, setIsConnError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openingJobId, setOpeningJobId] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    setIsConnError(false);
    try {
      const data = await apiGet('/history');
      setJobs(data || []);
    } catch (err) {
      setError(err.message || 'Error loading reel archive.');
      setIsConnError(Boolean(err.isConnection));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (e, jobId) => {
    e.stopPropagation();
    if (!window.confirm('Erase this project and its spooled reels from the archive?')) return;

    try {
      await apiDelete(`/jobs/${encodeURIComponent(jobId)}`);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      alert(err.message || 'Error deleting reel');
    }
  };

  const handleOpenResults = async (job) => {
    if (onOpenJob) {
      setOpeningJobId(job.id);
      await onOpenJob(job);
      setOpeningJobId('');
    }
  };

  const handleDirectToEditor = async (e, job) => {
    e.stopPropagation();
    if (!onOpenEditor) return;
    setOpeningJobId(job.id);
    try {
      const clips = await apiGet(`/jobs/${job.id}/clips`);
      if (clips && clips.length > 0) {
        onOpenEditor(clips[0]);
      } else if (onOpenJob) {
        onOpenJob(job);
      }
    } catch (err) {
      console.error('Error opening clip in editor:', err);
    } finally {
      setOpeningJobId('');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const filteredJobs = jobs.filter((j) => {
    const q = searchQuery.toLowerCase();
    const title = (j.video_title || '').toLowerCase();
    const url = (j.url || '').toLowerCase();
    return title.includes(q) || url.includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-5 border-b border-cz-border">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded bg-cz-surface border border-cz-border flex items-center justify-center text-cz-ember shadow-inner">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-cz-bone uppercase leading-none">
                CELLULOID REEL ARCHIVE
              </h2>
              {jobs.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded bg-cz-surface border border-cz-border text-cz-bone font-medium tabular-nums">
                  {jobs.length} {jobs.length === 1 ? 'project' : 'projects'}
                </span>
              )}
            </div>
            <p className="text-xs text-cz-muted font-sans mt-1">
              Historical ledger of past devotions, spooled shorts, and timeline edits
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-cz-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reels by title or URL..."
              className="bg-cz-surface border border-cz-border rounded-md pl-8 pr-3 py-1.5 text-xs text-cz-bone placeholder:text-cz-muted/60 focus:outline-none focus:border-cz-ember w-52 sm:w-64 font-sans"
            />
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="p-2 rounded bg-cz-surface border border-cz-border text-cz-muted hover:text-cz-bone hover:border-cz-muted transition-colors disabled:opacity-50 cursor-pointer"
            title="Scan Archive"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cz-ember' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error / Engine Offline Notice */}
      {error && (
        <div className="mb-6 p-5 rounded-lg bg-cz-surface border border-rose-900/80 shadow-xl">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-cz-bone font-sans mb-1">
                {isConnError ? 'Clipzilla Processing Engine Offline' : 'Archive Readout Failed'}
              </h4>
              <p className="text-xs text-cz-muted font-sans leading-relaxed mb-3">
                {error}
              </p>
              <button
                type="button"
                onClick={fetchHistory}
                className="px-3.5 py-1.5 rounded bg-cz-ember hover:bg-cz-ember-hover text-cz-bone text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_2px_0_0_#9a2b05]"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-12 h-12 rounded-md bg-cz-surface border border-cz-border flex items-center justify-center mx-auto mb-4 text-cz-muted">
            <Disc className="w-6 h-6 text-cz-ember animate-reel-spin" />
          </div>
          <p className="font-display text-xl tracking-wider text-cz-bone uppercase">
            READING CELLULOID ARCHIVES...
          </p>
          <p className="text-xs text-cz-muted font-sans mt-1">
            Loading past reels and spooled shorts
          </p>
        </div>
      ) : jobs.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 bg-cz-surface border border-cz-border rounded-lg max-w-lg mx-auto p-8 relative overflow-hidden shadow-2xl">
          <div className="h-1.5 w-full sprocket-track-h opacity-40 absolute top-0 left-0 border-b border-cz-border/40" />

          <div className="w-16 h-16 rounded-md bg-cz-base border border-cz-border flex items-center justify-center mx-auto mb-5 text-cz-muted">
            <Film className="w-8 h-8 text-cz-ember" />
          </div>

          <h3 className="font-display text-3xl tracking-wide text-cz-bone uppercase mb-2">
            ARCHIVE VAULT IS EMPTY
          </h3>
          <p className="text-xs sm:text-sm text-cz-muted mb-7 font-sans leading-relaxed max-w-sm mx-auto">
            No past video conversions logged yet. Feed a YouTube video to Clipzilla to generate vertical reels and record history.
          </p>

          <button
            type="button"
            onClick={() => onNavigateToCreate ? onNavigateToCreate() : window.location.reload()}
            className="inline-flex items-center space-x-2 px-6 py-3 rounded bg-cz-ember hover:bg-cz-ember-hover text-cz-bone font-display tracking-widest text-lg uppercase shadow-[0_3px_0_0_#9a2b05] active:translate-y-[2px] transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>DEVOUR FIRST VIDEO</span>
          </button>

          <div className="h-1.5 w-full sprocket-track-h opacity-40 absolute bottom-0 left-0 border-t border-cz-border/40" />
        </div>
      ) : filteredJobs.length === 0 ? (
        /* No Search Matches */
        <div className="text-center py-16 bg-cz-surface border border-cz-border rounded-lg p-6 max-w-md mx-auto">
          <Search className="w-8 h-8 text-cz-muted mx-auto mb-3" />
          <h4 className="font-display text-xl text-cz-bone uppercase">No Matching Reels Found</h4>
          <p className="text-xs text-cz-muted mt-1">No past projects match '{searchQuery}'.</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-4 px-3 py-1.5 bg-cz-base hover:bg-cz-raised border border-cz-border rounded text-xs text-cz-bone font-medium cursor-pointer"
          >
            Clear Search Filter
          </button>
        </div>
      ) : (
        /* Populated Job List */
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const isDone = job.status === 'done';
            const isFailed = job.status === 'failed';
            const isProcessing = ['downloading', 'transcribing', 'analyzing', 'rendering', 'queued'].includes(job.status);
            const isOpeningThis = openingJobId === job.id;

            return (
              <div
                key={job.id}
                onClick={() => handleOpenResults(job)}
                className="bg-cz-surface border border-cz-border hover:border-cz-muted/70 rounded-lg p-5 shadow-lg transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group relative overflow-hidden"
              >
                {/* Left Side: Thumbnail or Reel Icon & Info */}
                <div className="flex items-start sm:items-center space-x-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded bg-cz-base border border-cz-border flex items-center justify-center shrink-0 text-cz-muted group-hover:text-cz-bone transition-colors">
                    {isProcessing ? (
                      <Disc className="w-6 h-6 text-cz-ember animate-reel-spin" />
                    ) : isDone ? (
                      <Film className="w-6 h-6 text-cz-sensor" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-rose-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          isDone
                            ? 'bg-cz-base border-cz-sensor/40 text-cz-sensor'
                            : isFailed
                            ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                            : 'bg-cz-ember-subtle border-cz-ember text-cz-bone'
                        }`}
                      >
                        {job.status}
                      </span>

                      {job.export_preset && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cz-base border border-cz-border text-cz-muted uppercase tracking-wider">
                          {job.export_preset.replace('_', ' ')}
                        </span>
                      )}

                      <span className="text-[11px] text-cz-muted tabular-nums">
                        {formatDate(job.created_at)}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-cz-bone truncate font-sans group-hover:text-cz-ember transition-colors">
                      {job.video_title || `Reel Project [${job.video_id || job.id.slice(0, 8)}]`}
                    </h3>

                    <div className="flex items-center space-x-3 text-xs text-cz-muted mt-1">
                      {job.video_id && <span>ID: {job.video_id}</span>}
                      {job.url && (
                        <>
                          <span>/</span>
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-cz-bone hover:underline flex items-center space-x-1 truncate max-w-xs"
                          >
                            <span>Source</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side: Reel Count & Actions */}
                <div className="flex items-center space-x-3 shrink-0 border-t sm:border-t-0 border-cz-border/40 pt-3 sm:pt-0">
                  <div className="text-right">
                    <span className="text-xs font-bold text-cz-bone block tabular-nums">
                      {job.clip_count || 0} {(job.clip_count === 1) ? 'Reel Spooled' : 'Reels Spooled'}
                    </span>
                    <span className="text-[10px] text-cz-muted">Click to view shorts</span>
                  </div>

                  <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleOpenResults(job)}
                      disabled={isOpeningThis}
                      className="px-3 py-1.5 rounded bg-cz-raised hover:bg-cz-border border border-cz-border text-cz-bone text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isOpeningThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Inspect'}
                    </button>

                    {isDone && (job.clip_count > 0) && (
                      <button
                        type="button"
                        onClick={(e) => handleDirectToEditor(e, job)}
                        className="p-1.5 rounded bg-cz-raised hover:bg-cz-border border border-cz-border text-cz-bone hover:text-cz-ember transition-colors cursor-pointer"
                        title="Open First Reel in Timeline Editor"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDeleteJob(e, job.id)}
                      className="p-1.5 rounded bg-cz-base hover:bg-rose-950/60 border border-cz-border hover:border-rose-800 text-cz-muted hover:text-rose-300 transition-colors cursor-pointer"
                      title="Delete from Archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

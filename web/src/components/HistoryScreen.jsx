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
import StatBlockRow from './StatBlockRow';
import PillBadge from './PillBadge';

export default function HistoryScreen({ onOpenJob, onOpenEditor, onNavigateToCreate }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isConnError, setIsConnError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openingJobId, setOpeningJobId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clearingFailed, setClearingFailed] = useState(false);

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

  const handleClearFailed = async () => {
    const failedCount = jobs.filter((j) => j.status === 'failed').length;
    if (failedCount === 0) return;
    if (!window.confirm(`Purge all ${failedCount} failed project(s) and their reels from the archive?`)) return;

    setClearingFailed(true);
    try {
      await apiDelete('/history/failed');
      setJobs((prev) => prev.filter((j) => j.status !== 'failed'));
      if (statusFilter === 'failed') setStatusFilter('all');
    } catch (err) {
      alert(err.message || 'Error clearing failed projects');
    } finally {
      setClearingFailed(false);
    }
  };

  const handleOpenResults = async (job) => {
    if (job.status === 'failed' && (!job.clip_count || job.clip_count === 0)) {
      return;
    }
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

  const completedCount = jobs.filter((j) => j.status === 'done').length;
  const processingCount = jobs.filter((j) =>
    ['downloading', 'transcribing', 'analyzing', 'rendering', 'queued'].includes(j.status)
  ).length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;
  const totalClipsGenerated = jobs.reduce((acc, j) => acc + (j.clip_count || 0), 0);

  const filteredJobs = jobs.filter((j) => {
    if (statusFilter === 'done' && j.status !== 'done') return false;
    if (
      statusFilter === 'processing' &&
      !['downloading', 'transcribing', 'analyzing', 'rendering', 'queued'].includes(j.status)
    )
      return false;
    if (statusFilter === 'failed' && j.status !== 'failed') return false;

    const q = searchQuery.toLowerCase();
    const title = (j.video_title || '').toLowerCase();
    const url = (j.url || '').toLowerCase();
    return title.includes(q) || url.includes(q);
  });

  const lifetimeStats = [
    { label: 'Total Ingests', value: jobs.length, hint: 'Lifetime video jobs' },
    { label: 'Reels Produced', value: totalClipsGenerated, hint: 'Ready vertical shorts' },
    { label: 'Active Pipeline', value: processingCount, hint: 'Devouring / rendering' },
    { label: 'Archived Rate', value: `${jobs.length ? Math.round((completedCount / jobs.length) * 100) : 100}%`, hint: 'Ingest success ratio' },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-cz-ink">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 bg-cz-parchment border-2 border-cz-ink flex items-center justify-center text-cz-rust shadow-[2px_2px_0px_#18140F]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-cz-ink uppercase leading-none">
                CELLULOID REEL <span className="font-serif italic font-normal text-cz-moss lowercase tracking-normal">archive</span>.
              </h2>
              {jobs.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 bg-cz-paper border border-cz-ink text-cz-ink font-bold tabular-nums">
                  {jobs.length} {jobs.length === 1 ? 'project' : 'projects'}
                </span>
              )}
            </div>
            <p className="text-xs text-cz-ink/70 mt-1">
              Historical ledger of past devotions, spooled shorts, and timeline edits
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-cz-ink/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reels by title or URL..."
              className="bg-cz-paper border-2 border-cz-ink pl-8 pr-3 py-1.5 text-xs text-cz-ink placeholder:text-cz-ink/40 focus:outline-none focus:border-cz-rust w-52 sm:w-64"
            />
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="p-2 bg-cz-parchment border-2 border-cz-ink text-cz-ink hover:bg-cz-paper transition-colors disabled:opacity-50 cursor-pointer shadow-[2px_2px_0px_#18140F]"
            title="Scan Archive"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cz-rust' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stat-Block Row for Lifetime Totals */}
      {jobs.length > 0 && <StatBlockRow stats={lifetimeStats} />}

      {/* Filter Tabs and Clear Failed Projects Button */}
      {jobs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-cz-parchment border-2 border-cz-ink p-2">
          <div className="flex items-center space-x-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                  : 'bg-cz-paper text-cz-ink border-2 border-cz-ink/30 hover:border-cz-ink'
              }`}
            >
              All ({jobs.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('done')}
              className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'done'
                  ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                  : 'bg-cz-paper text-cz-ink border-2 border-cz-ink/30 hover:border-cz-ink'
              }`}
            >
              Completed ({completedCount})
            </button>
            {processingCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('processing')}
                className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'processing'
                    ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                    : 'bg-cz-paper text-cz-ink border-2 border-cz-ink/30 hover:border-cz-ink'
                }`}
              >
                In Progress ({processingCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'failed'
                  ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                  : 'bg-cz-paper text-cz-ink border-2 border-cz-ink/30 hover:border-cz-ink'
              }`}
            >
              Failed ({failedCount})
            </button>
          </div>

          {failedCount > 0 && (
            <button
              type="button"
              onClick={handleClearFailed}
              disabled={clearingFailed}
              className="flex items-center space-x-1.5 px-3 py-1 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-rust text-cz-rust text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              title="Purge all failed projects from archive"
            >
              {clearingFailed ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Purge failed projects ({failedCount})</span>
            </button>
          )}
        </div>
      )}

      {/* Error / Engine Offline Notice Styled in Poster System */}
      {error && (
        <div className="mb-6 p-6 bg-cz-parchment border-2 border-cz-rust shadow-[4px_4px_0px_#C1502E]">
          <div className="flex items-start space-x-3.5">
            <AlertCircle className="w-6 h-6 text-cz-rust shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-display text-2xl tracking-wider text-cz-ink uppercase mb-1">
                {isConnError ? 'PROCESSING ENGINE DISCONNECTED' : 'ARCHIVE READOUT INTERRUPTED'}
              </h4>
              <p className="text-xs text-cz-ink/80 leading-relaxed mb-4 max-w-xl">
                {error}
              </p>
              <button
                type="button"
                onClick={fetchHistory}
                className="px-4 py-2 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper text-xs font-bold uppercase tracking-wider border-2 border-cz-ink shadow-[2px_2px_0px_#18140F] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
              >
                Retry connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-20 text-center bg-cz-parchment border-2 border-cz-ink my-4 shadow-[4px_4px_0px_#18140F] max-w-md mx-auto p-8">
          <div className="w-12 h-12 bg-cz-paper border-2 border-cz-ink flex items-center justify-center mx-auto mb-4 text-cz-rust shadow-[2px_2px_0px_#18140F]">
            <Disc className="w-6 h-6 animate-reel-spin" />
          </div>
          <p className="font-display text-2xl tracking-tight text-cz-ink uppercase">
            READING CELLULOID ARCHIVES...
          </p>
          <p className="text-xs text-cz-ink/70 mt-1">
            Loading past reels and spooled shorts
          </p>
        </div>
      ) : jobs.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 bg-cz-parchment border-2 border-cz-ink max-w-lg mx-auto p-8 relative shadow-[4px_4px_0px_#18140F]">
          <div className="w-16 h-16 bg-cz-paper border-2 border-cz-ink flex items-center justify-center mx-auto mb-4 text-cz-rust shadow-[2px_2px_0px_#18140F]">
            <Film className="w-8 h-8" />
          </div>

          <h3 className="font-display text-3xl sm:text-4xl tracking-tight text-cz-ink uppercase mb-2">
            ARCHIVE VAULT IS EMPTY
          </h3>
          <p className="text-xs sm:text-sm text-cz-ink/75 mb-6 leading-relaxed max-w-sm mx-auto">
            No past video conversions logged yet. Feed a YouTube video to Clipzilla to generate vertical reels and record history.
          </p>

          <button
            type="button"
            onClick={() => (onNavigateToCreate ? onNavigateToCreate() : window.location.reload())}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper font-sans font-bold text-base uppercase border-2 border-cz-ink shadow-[3px_3px_0px_#18140F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#18140F] transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Devour first video</span>
          </button>
        </div>
      ) : filteredJobs.length === 0 ? (
        /* No Search Matches */
        <div className="text-center py-14 bg-cz-parchment border-2 border-cz-ink p-6 max-w-md mx-auto shadow-[3px_3px_0px_#18140F]">
          <Search className="w-8 h-8 text-cz-rust mx-auto mb-3" />
          <h4 className="font-display text-xl text-cz-ink uppercase">No Matching Reels Found</h4>
          <p className="text-xs text-cz-ink/70 mt-1">No past projects match '{searchQuery}'.</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-4 px-3 py-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-ink text-xs font-bold cursor-pointer"
          >
            Clear Search Filter
          </button>
        </div>
      ) : (
        /* Populated Job Ledger Rows */
        <div className="bg-cz-parchment border-2 border-cz-ink shadow-[4px_4px_0px_#18140F] divide-y-2 divide-cz-parchment-border">
          {filteredJobs.map((job) => {
            const isDone = job.status === 'done';
            const isFailed = job.status === 'failed';
            const isProcessing = ['downloading', 'transcribing', 'analyzing', 'rendering', 'queued'].includes(job.status);
            const isOpeningThis = openingJobId === job.id;

            return (
              <div
                key={job.id}
                onClick={() => handleOpenResults(job)}
                className="p-4 sm:p-5 hover:bg-cz-paper transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                {/* Left Side: Thumbnail or Reel Icon & Info */}
                <div className="flex items-start sm:items-center space-x-4 min-w-0 flex-1">
                  <div className="w-12 h-12 bg-cz-paper border-2 border-cz-ink flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#18140F]">
                    {isProcessing ? (
                      <Disc className="w-6 h-6 text-cz-rust animate-reel-spin" />
                    ) : isDone ? (
                      <Film className="w-6 h-6 text-cz-moss" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-cz-rust" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${
                          isDone
                            ? 'bg-cz-paper border-cz-moss text-cz-moss'
                            : isFailed
                            ? 'bg-cz-paper border-cz-rust text-cz-rust'
                            : 'bg-cz-rust text-cz-paper border-cz-ink'
                        }`}
                      >
                        {job.status}
                      </span>

                      {job.export_preset && (
                        <span className="text-[10px] px-2 py-0.5 bg-cz-paper border border-cz-ink/40 text-cz-ink uppercase tracking-wider font-semibold">
                          {job.export_preset.replace('_', ' ')}
                        </span>
                      )}

                      <span className="text-[11px] text-cz-ink/70 tabular-nums">
                        {formatDate(job.created_at)}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-cz-ink truncate group-hover:text-cz-rust transition-colors">
                      {job.video_title || `Reel Project [${job.video_id || job.id.slice(0, 8)}]`}
                    </h3>

                    {/* Failure details if applicable */}
                    {isFailed && (job.error_message || job.stage_message) && (
                      <div className="mt-2 text-xs text-cz-rust bg-cz-paper border border-cz-rust p-2 flex items-start space-x-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-cz-rust shrink-0 mt-0.5" />
                        <span className="truncate">{job.error_message || job.stage_message}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-3 text-xs text-cz-ink/70 mt-1">
                      {job.video_id && <span>ID: {job.video_id}</span>}
                      {job.url && (
                        <>
                          <span>&bull;</span>
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline text-cz-rust font-semibold flex items-center space-x-1 truncate max-w-xs"
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
                <div className="flex items-center space-x-3 shrink-0 border-t sm:border-t-0 border-cz-ink/20 pt-3 sm:pt-0">
                  <div className="text-right">
                    {isFailed ? (
                      <>
                        <span className="text-xs font-bold text-cz-rust block">Failed Project</span>
                        <span className="text-[10px] text-cz-ink/60">No reels produced</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-cz-ink block tabular-nums">
                          {job.clip_count || 0} {(job.clip_count === 1) ? 'Reel Spooled' : 'Reels Spooled'}
                        </span>
                        <span className="text-[10px] text-cz-ink/60">
                          {(job.clip_count > 0) ? 'Click to open batch' : 'No shorts generated'}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    {isFailed ? (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteJob(e, job.id)}
                        className="px-3 py-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-rust text-cz-rust text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-[1px_1px_0px_#18140F]"
                        title="Delete failed project from archive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenResults(job)}
                          disabled={isOpeningThis || (job.clip_count === 0)}
                          className="px-3 py-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-ink text-cz-ink text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 shadow-[1px_1px_0px_#18140F]"
                        >
                          {isOpeningThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'View Batch →'}
                        </button>

                        {isDone && (job.clip_count > 0) && (
                          <button
                            type="button"
                            onClick={(e) => handleDirectToEditor(e, job)}
                            className="p-1.5 bg-cz-paper hover:bg-cz-parchment border-2 border-cz-ink text-cz-ink hover:text-cz-rust transition-colors cursor-pointer shadow-[1px_1px_0px_#18140F]"
                            title="Open First Reel in Timeline Editor"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleDeleteJob(e, job.id)}
                          className="p-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-ink text-cz-ink transition-colors cursor-pointer shadow-[1px_1px_0px_#18140F]"
                          title="Delete from Archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
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

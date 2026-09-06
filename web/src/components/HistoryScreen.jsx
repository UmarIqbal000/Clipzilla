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
} from 'lucide-react';

export default function HistoryScreen({ onOpenJob, onOpenEditor }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [openingJobId, setOpeningJobId] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/history');
      if (!res.ok) throw new Error(`Failed to load history: ${res.statusText}`);
      const data = await res.json();
      setJobs(data || []);
    } catch (err) {
      setError(err.message || 'Error loading project history.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (e, jobId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this project and its generated clips from history?')) return;

    try {
      const res = await fetch(`/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete job');
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      alert(err.message || 'Error deleting project');
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
      const res = await fetch(`/jobs/${job.id}/clips`);
      if (res.ok) {
        const clips = await res.json();
        if (clips && clips.length > 0) {
          onOpenEditor(clips[0]);
        } else {
          onOpenJob(job);
        }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Project History</h2>
            <p className="text-xs text-slate-400">
              Browse past video conversions, inspect metadata, and reopen results or the timeline editor.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-64"
            />
          </div>

          <button
            onClick={fetchHistory}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh History"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
          <p className="text-sm">Loading Project History...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20 bg-slate-900/40 border border-slate-800/80 rounded-2xl max-w-lg mx-auto p-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Past Projects Found</h3>
          <p className="text-sm text-slate-400 mb-6">
            {searchQuery
              ? 'No projects match your search query.'
              : 'Submit a YouTube video in the Create tab to generate shorts and start building your history.'}
          </p>
        </div>
      ) : (
        /* Jobs List */
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const isDone = job.status === 'done';
            const isFailed = job.status === 'failed';
            const isWorking = ['queued', 'downloading', 'transcribing', 'analyzing', 'rendering'].includes(job.status);
            const isOpening = openingJobId === job.id;

            return (
              <div
                key={job.id}
                onClick={() => isDone && handleOpenResults(job)}
                className={`p-4 sm:p-5 rounded-2xl border bg-slate-900/70 backdrop-blur transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isDone
                    ? 'cursor-pointer hover:border-slate-700 hover:bg-slate-900/90'
                    : 'border-slate-800'
                }`}
              >
                {/* Left: Video Details */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <h3 className="font-bold text-sm sm:text-base text-white truncate max-w-md sm:max-w-xl">
                      {job.video_title || 'YouTube Video'}
                    </h3>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                        isDone
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : isFailed
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {job.status}
                    </span>

                    {/* Export Preset Badge */}
                    {job.export_preset && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                        {job.export_preset.replace('_', ' ')}
                      </span>
                    )}

                    {/* Batch indicator */}
                    {job.batch_id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-medium">
                        Batch
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-slate-400 flex-wrap gap-y-1">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDate(job.created_at)}</span>
                    </span>

                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-400 hover:text-emerald-400 flex items-center space-x-1 truncate max-w-[200px]"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{job.url}</span>
                    </a>

                    {Boolean(job.clip_count) && (
                      <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                        <Film className="w-3.5 h-3.5" />
                        <span>
                          {job.clip_count} {job.clip_count === 1 ? 'short' : 'shorts'}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  {isDone && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => handleDirectToEditor(e, job)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                        title="Open in Timeline Editor"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Editor</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenResults(job)}
                        disabled={isOpening}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-emerald-500/20 transition-all"
                      >
                        {isOpening ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Film className="w-3.5 h-3.5" />
                        )}
                        <span>Open Shorts</span>
                      </button>
                    </>
                  )}

                  {isWorking && (
                    <div className="flex items-center space-x-1.5 text-xs text-amber-400 font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{job.progress}%</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleDeleteJob(e, job.id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Delete Project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

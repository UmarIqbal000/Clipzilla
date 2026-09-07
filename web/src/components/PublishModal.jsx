import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Calendar,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  Youtube,
  Instagram,
  Facebook,
  UploadCloud,
  History,
  Info
} from 'lucide-react';
import { apiGet, apiPost } from '../api/client';

export default function PublishModal({ clip, onClose, onPublished }) {
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Form State
  const [title, setTitle] = useState(clip?.title || '');
  const [description, setDescription] = useState(clip?.reason || '');
  const [tags, setTags] = useState('#shorts, #viral');
  const [privacy, setPrivacy] = useState('Public');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  // Submission State
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  
  // Progress/Status State
  const [publishJobs, setPublishJobs] = useState([]); // array of active job IDs to poll
  const [jobStatuses, setJobStatuses] = useState({}); // map job ID to status obj
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    fetchAccounts();
    fetchHistory();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isPublishing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const fetchAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const data = await apiGet('/social-accounts');
      const list = Array.isArray(data) ? data : (data?.accounts || []);
      const activeAccounts = list.filter(a => a.is_active);
      setAccounts(activeAccounts);
      if (activeAccounts.length === 1) {
        setSelectedAccounts(new Set([activeAccounts[0].id]));
      }
    } catch (err) {
      setError(err.message || 'Failed to load social accounts.');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const fetchHistory = async () => {
    if (!clip?.id) return;
    setLoadingHistory(true);
    try {
      const data = await apiGet(`/clips/${clip.id}/publish-history`);
      const list = Array.isArray(data) ? data : (data?.history || []);
      setHistory(list);
    } catch (err) {
      console.error('Failed to load publish history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleAccount = (accId) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accId)) next.delete(accId);
      else next.add(accId);
      return next;
    });
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (selectedAccounts.size === 0) {
      setError('Select at least one social account to publish to.');
      return;
    }
    
    setIsPublishing(true);
    setError('');

    try {
      const payload = {
        account_ids: Array.from(selectedAccounts),
        title,
        description,
        tags,
        privacy,
        scheduled_at: isScheduled && scheduledAt ? scheduledAt : null,
      };

      const res = await apiPost(`/clips/${clip.id}/publish`, payload);
      
      const jobIds = res?.job_ids || (res?.publish_jobs ? res.publish_jobs.map(j => j.publish_job_id) : []);
      if (jobIds && jobIds.length > 0) {
        setPublishJobs(jobIds);
        startPollingJobs(jobIds);
      } else {
        if (onPublished) onPublished();
      }
    } catch (err) {
      setError(err.message || 'Failed to initiate publish.');
      setIsPublishing(false);
    }
  };

  const startPollingJobs = (jobIds) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      let allDone = true;
      const newStatuses = { ...jobStatuses };

      for (const jobId of jobIds) {
        try {
          const jobRes = await apiGet(`/publish-jobs/${jobId}`);
          if (jobRes) {
            newStatuses[jobId] = jobRes;
            const isDone = jobRes.status === 'published' || jobRes.status === 'completed' || jobRes.status === 'failed';
            if (!isDone) {
              allDone = false;
            }
          }
        } catch (err) {
          console.error(`Error polling job ${jobId}:`, err);
        }
      }

      setJobStatuses(newStatuses);

      if (allDone) {
        clearInterval(pollingIntervalRef.current);
        setIsPublishing(false);
        fetchHistory();
        if (onPublished) onPublished();
      }
    }, 2000);
  };

  const renderPlatformIcon = (platform, className = "w-4 h-4") => {
    switch (platform?.toLowerCase()) {
      case 'youtube': return <Youtube className={`${className} text-red-600`} />;
      case 'instagram': return <Instagram className={`${className} text-pink-600`} />;
      case 'facebook': return <Facebook className={`${className} text-blue-600`} />;
      default: return <Send className={`${className} text-cz-ink`} />;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '00:00';
    const s = Math.round(seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-cz-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-cz-paper border-2 border-cz-ink w-full max-w-xl max-h-[90vh] shadow-[6px_6px_0px_#18140F] flex flex-col relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-cz-parchment border-b-2 border-cz-ink shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 bg-cz-paper border-2 border-cz-ink flex items-center justify-center text-cz-rust shrink-0 shadow-[2px_2px_0px_#18140F]">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-2xl tracking-wide text-cz-ink uppercase leading-none truncate">
                PUBLISH SHORT
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-[11px] font-bold text-cz-ink/80 truncate max-w-[200px] sm:max-w-[300px]">
                  {clip?.title}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-cz-ink text-cz-paper border border-cz-ink shrink-0 tabular-nums">
                  {formatDuration(clip?.duration)}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing && publishJobs.length === 0}
            className="p-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-ink text-cz-ink transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto font-sans flex-1 space-y-6">
          
          {error && (
            <div className="p-3 bg-cz-parchment border-2 border-cz-rust flex items-start space-x-2 text-cz-rust text-xs shadow-[2px_2px_0px_#C1502E]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-bold">{error}</span>
            </div>
          )}

          {/* Account Selection */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-cz-ink uppercase tracking-wider">
              1. Select Destination Accounts
            </label>
            {loadingAccounts ? (
              <div className="flex items-center space-x-2 text-xs text-cz-ink/70 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading accounts...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-4 border-2 border-dashed border-cz-ink/40 bg-cz-parchment text-center">
                <p className="text-xs text-cz-ink mb-2">No connected social accounts found.</p>
                <a href="/accounts" className="text-xs font-bold text-cz-rust hover:underline inline-flex items-center space-x-1">
                  <span>Connect accounts in Settings</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {accounts.map(acc => (
                  <label 
                    key={acc.id}
                    className={`flex items-center space-x-3 p-3 border-2 cursor-pointer transition-colors ${
                      selectedAccounts.has(acc.id) 
                        ? 'border-cz-ink bg-cz-parchment shadow-[2px_2px_0px_#18140F]' 
                        : 'border-cz-ink/30 bg-cz-paper hover:border-cz-ink/60'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-cz-rust cursor-pointer"
                      checked={selectedAccounts.has(acc.id)}
                      onChange={() => toggleAccount(acc.id)}
                      disabled={isPublishing}
                    />
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      {renderPlatformIcon(acc.platform)}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-cz-ink truncate">{acc.account_name || acc.name}</p>
                        <p className="text-[10px] text-cz-ink/70 truncate">@{acc.account_handle || acc.handle || 'account'}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Post Metadata Form */}
          <div className="space-y-4">
            <label className="block text-[11px] font-bold text-cz-ink uppercase tracking-wider">
              2. Post Details
            </label>
            
            <div>
              <label className="block text-[10px] font-bold text-cz-ink uppercase mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isPublishing}
                className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust font-sans"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-cz-ink uppercase mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPublishing}
                rows={3}
                className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust font-sans resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-cz-ink uppercase mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  disabled={isPublishing}
                  className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust font-sans"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-cz-ink uppercase mb-1 flex items-center space-x-1">
                  <span>Privacy</span>
                  {privacy === 'Unlisted' && <Info className="w-3 h-3 text-cz-rust" title="Instagram may not support Unlisted" />}
                </label>
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value)}
                  disabled={isPublishing}
                  className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust font-sans appearance-none rounded-none"
                >
                  <option value="Public">Public</option>
                  <option value="Private">Private</option>
                  <option value="Unlisted">Unlisted</option>
                </select>
              </div>
            </div>
          </div>

          {/* Schedule Option */}
          <div className="space-y-3 pt-4 border-t-2 border-cz-ink/10">
            <label className="block text-[11px] font-bold text-cz-ink uppercase tracking-wider">
              3. Timing
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsScheduled(false)}
                disabled={isPublishing}
                className={`flex-1 min-w-[120px] py-2 px-3 border-2 text-xs font-bold transition-all ${
                  !isScheduled 
                    ? 'bg-cz-rust border-cz-ink text-cz-paper shadow-[2px_2px_0px_#18140F]' 
                    : 'bg-cz-paper border-cz-ink/30 text-cz-ink/70 hover:border-cz-ink/60'
                }`}
              >
                Publish Now
              </button>
              <button
                type="button"
                onClick={() => setIsScheduled(true)}
                disabled={isPublishing}
                className={`flex-1 min-w-[120px] py-2 px-3 border-2 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  isScheduled 
                    ? 'bg-cz-rust border-cz-ink text-cz-paper shadow-[2px_2px_0px_#18140F]' 
                    : 'bg-cz-paper border-cz-ink/30 text-cz-ink/70 hover:border-cz-ink/60'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule for Later</span>
              </button>
            </div>

            {isScheduled && (
              <div className="mt-2">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  disabled={isPublishing}
                  className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust font-sans"
                />
              </div>
            )}
          </div>

          {/* Publish History */}
          {!loadingHistory && history.length > 0 && (
            <div className="space-y-2 pt-4 border-t-2 border-cz-ink/10">
              <label className="flex items-center space-x-1.5 text-[11px] font-bold text-cz-ink uppercase tracking-wider">
                <History className="w-3.5 h-3.5" />
                <span>Previous Publications</span>
              </label>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-cz-parchment border border-cz-ink/20 text-xs">
                    <div className="flex items-center space-x-2">
                      {renderPlatformIcon(h.platform)}
                      <span className="font-bold">{h.account_name}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-[10px] text-cz-ink/70">
                        {new Date(h.published_at || h.created_at).toLocaleDateString()}
                      </span>
                      {h.status === 'published' ? (
                        <a href={h.post_url || '#'} target="_blank" rel="noreferrer" className="flex items-center space-x-1 text-cz-moss font-bold hover:underline">
                          <Check className="w-3 h-3" />
                          <span>Live</span>
                        </a>
                      ) : h.status === 'failed' ? (
                        <span className="flex items-center space-x-1 text-cz-rust font-bold">
                          <X className="w-3 h-3" />
                          <span>Failed</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-cz-ink/70 font-bold">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real-time Status Area */}
          {publishJobs.length > 0 && (
            <div className="pt-4 border-t-2 border-cz-ink/10 space-y-2">
              <label className="block text-[11px] font-bold text-cz-ink uppercase tracking-wider">
                Publishing Status
              </label>
              {publishJobs.map(jobId => {
                const statusObj = jobStatuses[jobId];
                const acc = accounts.find(a => a.id === statusObj?.account_id) || { name: statusObj?.account_name || 'Account', platform: statusObj?.platform };
                const isCompleted = statusObj?.status === 'published' || statusObj?.status === 'completed';
                const isFailed = statusObj?.status === 'failed';
                const progressVal = isCompleted ? 100 : (statusObj?.progress || 15);
                const postUrl = statusObj?.platform_post_url || statusObj?.post_url;

                return (
                  <div key={jobId} className="p-3 bg-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]">
                    <div className="flex items-center justify-between mb-2 text-xs">
                      <div className="flex items-center space-x-2 font-bold">
                        {renderPlatformIcon(acc.platform)}
                        <span>{acc.account_name || acc.name}</span>
                      </div>
                      <div>
                        {isCompleted ? (
                          <span className="text-cz-moss font-bold flex items-center space-x-1"><Check className="w-3 h-3" /> <span>Published</span></span>
                        ) : isFailed ? (
                          <span className="text-cz-rust font-bold flex items-center space-x-1"><X className="w-3 h-3" /> <span>Failed</span></span>
                        ) : (
                          <span className="text-cz-ink/70 flex items-center space-x-1"><Loader2 className="w-3 h-3 animate-spin" /> <span>{statusObj?.stage_message || statusObj?.status || 'Publishing...'}</span></span>
                        )}
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-cz-parchment border border-cz-ink overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${isCompleted ? 'bg-cz-moss' : isFailed ? 'bg-cz-rust' : 'bg-cz-ink'}`} 
                        style={{ width: `${progressVal}%` }} 
                      />
                    </div>
                    {isFailed && (statusObj?.error_message || statusObj?.error) && (
                      <p className="mt-2 text-[10px] text-cz-rust font-bold">{statusObj.error_message || statusObj.error}</p>
                    )}
                    {isCompleted && postUrl && (
                      <a href={postUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center space-x-1 text-[10px] text-cz-moss font-bold hover:underline">
                        <span>View Live Post</span> <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t-2 border-cz-ink bg-cz-parchment shrink-0 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing && publishJobs.length === 0}
            className="px-4 py-2 bg-cz-paper hover:bg-cz-parchment border-2 border-cz-ink text-cz-ink text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-[2px_2px_0px_#18140F]"
          >
            {publishJobs.length > 0 ? 'Close' : 'Cancel'}
          </button>
          
          {publishJobs.length === 0 && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing || selectedAccounts.size === 0}
              className="px-6 py-2 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper border-2 border-cz-ink text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[2px_2px_0px_#18140F] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : isScheduled ? (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>Schedule</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>🚀 Publish Now</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

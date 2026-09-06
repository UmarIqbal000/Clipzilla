import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import HomeScreen from './components/HomeScreen';
import ResultsScreen from './components/ResultsScreen';
import SettingsScreen from './components/SettingsScreen';
import EditorScreen from './components/EditorScreen';
import HistoryScreen from './components/HistoryScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [activeJob, setActiveJob] = useState(null);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [clips, setClips] = useState([]);
  const [editingClip, setEditingClip] = useState(null);
  const [loadingClips, setLoadingClips] = useState(false);
  const pollingRef = useRef(null);

  // On initial mount, restore the most recent job if one exists
  useEffect(() => {
    const fetchRecentJobs = async () => {
      try {
        const res = await fetch('/jobs');
        if (!res.ok) return;
        const jobs = await res.json();
        if (jobs && jobs.length > 0) {
          const latest = jobs[0];
          setActiveJob(latest);
          if (latest.batch_id) {
            setActiveBatchId(latest.batch_id);
          }
          if (latest.status === 'done') {
            fetchClips(latest.id, latest.batch_id);
          }
        }
      } catch (err) {
        console.error('Error fetching recent jobs:', err);
      }
    };

    fetchRecentJobs();
  }, []);

  const fetchClips = async (jobId, batchId = null) => {
    setLoadingClips(true);
    try {
      const endpoint = batchId ? `/batches/${batchId}/clips` : `/jobs/${jobId}/clips`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setClips(data);
      }
    } catch (err) {
      console.error('Error loading clips:', err);
    } finally {
      setLoadingClips(false);
    }
  };

  // Polling loop: every 2s while job or batch is active
  useEffect(() => {
    const isJobActive =
      activeJob &&
      ['queued', 'downloading', 'transcribing', 'analyzing', 'rendering'].includes(activeJob.status);

    if (isJobActive) {
      pollingRef.current = setInterval(async () => {
        try {
          if (activeBatchId) {
            const batchRes = await fetch(`/batches/${activeBatchId}`);
            if (batchRes.ok) {
              const batchData = await batchRes.json();
              if (batchData.is_complete) {
                clearInterval(pollingRef.current);
                await fetchClips(activeJob.id, activeBatchId);
                setActiveJob((prev) => ({ ...prev, status: 'done', progress: 100 }));
                setActiveTab('results');
                return;
              }
            }
          }

          const res = await fetch(`/jobs/${activeJob.id}`);
          if (!res.ok) return;
          const updated = await res.json();
          setActiveJob(updated);

          if (updated.status === 'done') {
            clearInterval(pollingRef.current);
            await fetchClips(updated.id, activeBatchId);
            setActiveTab('results');
          } else if (updated.status === 'failed') {
            clearInterval(pollingRef.current);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 2000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [activeJob?.id, activeJob?.status, activeBatchId]);

  const handleStartJob = async (payload) => {
    const res = await fetch('/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Failed to start job');
    }

    const resData = await res.json();
    if (resData.batch_id) {
      setActiveBatchId(resData.batch_id);
      const firstJob = (resData.jobs && resData.jobs[0]) || resData;
      setActiveJob(firstJob);
    } else {
      setActiveBatchId(null);
      setActiveJob(resData);
    }
    setClips([]);
  };

  const handleOpenEditor = (clipToEdit) => {
    setEditingClip(clipToEdit);
    setActiveTab('editor');
  };

  const handleClipUpdated = (updatedClip) => {
    setClips((prev) =>
      prev.map((c) => (c.id === updatedClip.id ? { ...c, ...updatedClip } : c))
    );
    setEditingClip((prev) => (prev?.id === updatedClip.id ? { ...prev, ...updatedClip } : prev));
  };

  const handleOpenJobFromHistory = async (job) => {
    setActiveJob(job);
    setActiveBatchId(job.batch_id || null);
    await fetchClips(job.id, job.batch_id);
    setActiveTab('results');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasClips={clips.length > 0}
        hasEditingClip={Boolean(editingClip)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'create' && (
          <HomeScreen
            onStartJob={handleStartJob}
            activeJob={activeJob}
            onNavigateToResults={() => setActiveTab('results')}
          />
        )}

        {activeTab === 'results' && (
          <ResultsScreen
            clips={clips}
            onBackToHome={() => setActiveTab('create')}
            onRefresh={() => activeJob?.id && fetchClips(activeJob.id, activeBatchId)}
            loading={loadingClips}
            onEditClip={handleOpenEditor}
          />
        )}

        {activeTab === 'editor' && editingClip && (
          <EditorScreen
            clip={editingClip}
            onBack={() => setActiveTab('results')}
            onClipUpdated={handleClipUpdated}
          />
        )}

        {activeTab === 'history' && (
          <HistoryScreen
            onOpenJob={handleOpenJobFromHistory}
            onOpenEditor={handleOpenEditor}
          />
        )}

        {activeTab === 'settings' && <SettingsScreen />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Clipzilla — monster that devours long-form and spits out shorts.
          </div>
          <div className="text-slate-600">
            Local-First &bull; 100% Private &bull; Open Source
          </div>
        </div>
      </footer>
    </div>
  );
}

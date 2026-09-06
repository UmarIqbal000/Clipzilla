import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import HomeScreen from './components/HomeScreen';
import ResultsScreen from './components/ResultsScreen';
import SettingsScreen from './components/SettingsScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [activeJob, setActiveJob] = useState(null);
  const [clips, setClips] = useState([]);
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
          if (latest.status === 'done') {
            fetchClips(latest.id);
          }
        }
      } catch (err) {
        console.error('Error fetching recent jobs:', err);
      }
    };

    fetchRecentJobs();
  }, []);

  const fetchClips = async (jobId) => {
    setLoadingClips(true);
    try {
      const res = await fetch(`/jobs/${jobId}/clips`);
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

  // Polling loop: every 2s while job is active
  useEffect(() => {
    const isJobActive =
      activeJob &&
      ['queued', 'downloading', 'transcribing', 'analyzing', 'rendering'].includes(activeJob.status);

    if (isJobActive) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/jobs/${activeJob.id}`);
          if (!res.ok) return;
          const updated = await res.json();
          setActiveJob(updated);

          if (updated.status === 'done') {
            clearInterval(pollingRef.current);
            await fetchClips(updated.id);
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
  }, [activeJob?.id, activeJob?.status]);

  const handleStartJob = async ({ url, preset, reframe }) => {
    const res = await fetch('/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, preset, reframe }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Failed to start job');
    }

    const newJob = await res.json();
    setActiveJob(newJob);
    setClips([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasClips={clips.length > 0}
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
            onRefresh={() => activeJob?.id && fetchClips(activeJob.id)}
            loading={loadingClips}
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

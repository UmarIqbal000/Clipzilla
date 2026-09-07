import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import HomeScreen from './components/HomeScreen';
import ResultsScreen from './components/ResultsScreen';
import SettingsScreen from './components/SettingsScreen';
import EditorScreen from './components/EditorScreen';
import HistoryScreen from './components/HistoryScreen';
import BatchDetailScreen from './components/BatchDetailScreen';
import AccountsScreen from './components/AccountsScreen';
import { apiGet } from './api/client';

export default function App() {
  const getInitialPath = () => {
    try {
      const pathname = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const idParam = params.get('id');

      // Gracefully handle any legacy ?tab= queries
      if (tabParam === 'results' || tabParam === 'shorts') return '/shorts';
      if (tabParam === 'history') return '/history';
      if (tabParam === 'accounts') return '/accounts';
      if (tabParam === 'settings') return '/settings';
      if (tabParam === 'editor') return '/editor';
      if (tabParam === 'batch' && idParam) return `/batch/${idParam}`;
      if (tabParam === 'create') return '/home';

      if (pathname === '/' || pathname === '') return '/home';
      return pathname;
    } catch {
      return '/home';
    }
  };

  const [currentPath, setCurrentPath] = useState(getInitialPath);

  const navigate = (path) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (window.location.pathname !== cleanPath) {
      window.history.pushState(null, '', cleanPath);
      setCurrentPath(cleanPath.toLowerCase());
    }
  };

  // Sync with browser Back and Forward buttons & normalize initial URL
  useEffect(() => {
    const initial = getInitialPath();
    if (window.location.pathname !== initial) {
      window.history.replaceState(null, '', initial);
      setCurrentPath(initial);
    }

    const onPopState = () => {
      const p = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/home';
      setCurrentPath(p === '/' ? '/home' : p);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [activeJob, setActiveJob] = useState(null);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [selectedBatchJob, setSelectedBatchJob] = useState(null);
  const [vaultClips, setVaultClips] = useState([]);
  const [hasLoadedVault, setHasLoadedVault] = useState(false);
  const [loadingVault, setLoadingVault] = useState(false);
  const [batchClips, setBatchClips] = useState([]);
  const [loadingBatchClips, setLoadingBatchClips] = useState(false);
  const [editingClip, setEditingClip] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);
  const [batchRouteNotFound, setBatchRouteNotFound] = useState(false);
  const pollingRef = useRef(null);

  // On initial mount, check for any in-progress job or active AI profile
  useEffect(() => {
    const initApp = async () => {
      try {
        const jobs = await apiGet('/jobs');
        if (jobs && jobs.length > 0) {
          const latest = jobs[0];
          if (['downloading', 'transcribing', 'analyzing', 'rendering'].includes(latest.status)) {
            // Only attach if actively processing in the current session
            setActiveJob(latest);
            if (latest.batch_id) setActiveBatchId(latest.batch_id);
          }
        }
      } catch (err) {
        console.error('Error fetching initial jobs:', err);
      }

      try {
        const pdata = await apiGet('/settings/profiles');
        if (pdata && pdata.profiles) {
          const act = pdata.profiles.find((p) => p.id === pdata.active_profile) || pdata.profiles[0];
          setActiveProfile(act || null);
        }
      } catch {}

      try {
        const accs = await apiGet('/social-accounts');
        if (accs && accs.length > 0) {
          setHasAccounts(true);
        }
      } catch {}
    };

    initApp();
  }, []);

  const [hasAccounts, setHasAccounts] = useState(false);

  const fetchBatchClips = async (jobId, batchId = null) => {
    setLoadingBatchClips(true);
    try {
      const endpoint = batchId ? `/batches/${batchId}/clips` : `/jobs/${jobId}/clips`;
      const data = await apiGet(endpoint);
      if (data) {
        setBatchClips(data);
      }
    } catch (err) {
      console.error('Error loading batch clips:', err);
    } finally {
      setLoadingBatchClips(false);
    }
  };

  // Refreshes the master vault only when invoked (e.g. by clicking "Refresh vault")
  const fetchVaultClips = async () => {
    setLoadingVault(true);
    try {
      const data = await apiGet('/clips');
      if (data) {
        setVaultClips(data);
        setHasLoadedVault(true);
      }
    } catch (err) {
      console.error('Error loading vault clips:', err);
    } finally {
      setLoadingVault(false);
    }
  };

  const isHome = currentPath === '/' || currentPath === '/home';
  const isShorts = currentPath === '/shorts';
  const isHistory = currentPath === '/history';
  const isBatch = currentPath.startsWith('/batch/');
  const isAccounts = currentPath === '/accounts';
  const isSettings = currentPath === '/settings';
  const isEditor = currentPath.startsWith('/editor');

  const routeBatchId = isBatch ? currentPath.replace('/batch/', '').split('/')[0].split('?')[0] : null;

  // Only load vault once on first visit to the Shorts tab if not loaded yet
  useEffect(() => {
    if (isShorts && !hasLoadedVault) {
      fetchVaultClips();
    }
  }, [isShorts, hasLoadedVault]);

  // When visiting /batch/:id, restore batch job and clips if not already loaded
  useEffect(() => {
    if (isBatch && routeBatchId) {
      if (!selectedBatchJob || selectedBatchJob.id !== routeBatchId) {
        setBatchRouteNotFound(false);
        apiGet(`/jobs/${routeBatchId}`)
          .then((j) => {
            if (j && j.id) {
              setSelectedBatchJob(j);
              setActiveBatchId(j.batch_id || null);
              fetchBatchClips(j.id, j.batch_id);
            } else {
              setBatchRouteNotFound(true);
            }
          })
          .catch((e) => {
            console.error('Failed to restore batch from route:', e);
            setBatchRouteNotFound(true);
          });
      }
    }
  }, [isBatch, routeBatchId]);

  // Polling loop: every 2s while job or batch is active
  useEffect(() => {
    const isJobActive =
      activeJob &&
      ['queued', 'downloading', 'transcribing', 'analyzing', 'rendering'].includes(activeJob.status);

    if (isJobActive) {
      pollingRef.current = setInterval(async () => {
        try {
          if (activeBatchId) {
            const batchData = await apiGet(`/batches/${activeBatchId}`);
            if (batchData && batchData.is_complete) {
              clearInterval(pollingRef.current);
              setSelectedBatchJob(activeJob);
              await fetchBatchClips(activeJob.id, activeBatchId);
              setActiveJob((prev) => ({ ...prev, status: 'done', progress: 100 }));
              navigate(`/batch/${activeJob.id}`);
              return;
            }
          }

          const updated = await apiGet(`/jobs/${activeJob.id}`);
          if (updated) {
            setActiveJob(updated);

            if (updated.status === 'done') {
              clearInterval(pollingRef.current);
              setSelectedBatchJob(updated);
              await fetchBatchClips(updated.id, activeBatchId);
              navigate(`/batch/${updated.id}`);
            } else if (updated.status === 'failed') {
              clearInterval(pollingRef.current);
            }
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
      setSelectedBatchJob(firstJob);
    } else {
      setActiveBatchId(null);
      setActiveJob(resData);
      setSelectedBatchJob(resData);
    }
    setBatchClips([]);
  };

  const handleOpenEditor = (clipToEdit) => {
    setEditingClip(clipToEdit);
    navigate('/editor');
  };

  const handleClipUpdated = (updatedClip) => {
    setVaultClips((prev) =>
      prev.map((c) => (c.id === updatedClip.id ? { ...c, ...updatedClip } : c))
    );
    setBatchClips((prev) =>
      prev.map((c) => (c.id === updatedClip.id ? { ...c, ...updatedClip } : c))
    );
    setEditingClip((prev) => (prev?.id === updatedClip.id ? { ...prev, ...updatedClip } : prev));
  };

  const handleOpenJobFromHistory = async (job) => {
    setSelectedBatchJob(job);
    setActiveBatchId(job.batch_id || null);
    await fetchBatchClips(job.id, job.batch_id);
    navigate(`/batch/${job.id}`);
  };

  return (
    <div className="min-h-screen bg-cz-paper text-cz-ink flex flex-col font-sans selection:bg-cz-rust selection:text-cz-paper overflow-x-hidden w-full">


      {/* Top Navbar */}
      <Navbar
        currentPath={currentPath}
        navigate={navigate}
        hasClips={vaultClips.length > 0}
        hasAccounts={hasAccounts}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-8">
        {isHome && (
          <HomeScreen
            onStartJob={handleStartJob}
            activeJob={activeJob}
            onNavigateToResults={() => {
              if (activeJob) {
                setSelectedBatchJob(activeJob);
                navigate(`/batch/${activeJob.id}`);
              } else {
                navigate('/shorts');
              }
            }}
            onNavigateToSettings={() => navigate('/settings')}
            onDismissJob={() => {
              setActiveJob(null);
              setActiveBatchId(null);
            }}
          />
        )}

        {isShorts && (
          <ResultsScreen
            clips={vaultClips}
            onBackToHome={() => navigate('/home')}
            onRefresh={fetchVaultClips}
            loading={loadingVault}
            onEditClip={handleOpenEditor}
            onDeleteClip={(clipId) => setVaultClips((prev) => prev.filter((c) => c.id !== clipId))}
          />
        )}

        {isBatch && selectedBatchJob && (
          <BatchDetailScreen
            job={selectedBatchJob}
            clips={batchClips}
            onBackToHistory={() => {
              setSelectedBatchJob(null);
              navigate('/history');
            }}
            onRefresh={() => {
              if (selectedBatchJob) {
                fetchBatchClips(selectedBatchJob.id, selectedBatchJob.batch_id);
              }
            }}
            loading={loadingBatchClips}
            onEditClip={handleOpenEditor}
            onDeleteClip={(clipId) => setBatchClips((prev) => prev.filter((c) => c.id !== clipId))}
          />
        )}

        {isBatch && !selectedBatchJob && (
          <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            {batchRouteNotFound ? (
              <div className="bg-cz-parchment border-2 border-cz-ink p-8 shadow-poster inline-block max-w-lg">
                <h3 className="font-display text-2xl tracking-wider uppercase mb-2">Batch Not Found</h3>
                <p className="font-mono text-xs text-cz-ink/70 mb-6">
                  No reel spool corresponds to identifier {routeBatchId}.
                </p>
                <button
                  onClick={() => navigate('/history')}
                  className="bg-cz-rust text-cz-paper px-6 py-2.5 font-display text-sm uppercase tracking-wider border-2 border-cz-ink shadow-poster hover:translate-x-0.5 hover:translate-y-0.5"
                >
                  Return to Archive
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 py-16">
                <div className="w-10 h-10 border-4 border-cz-rust border-t-transparent rounded-full animate-spin"></div>
                <p className="font-mono text-xs text-cz-ink/70 uppercase tracking-widest font-bold">
                  Retrieving reel batch spool...
                </p>
              </div>
            )}
          </div>
        )}

        {isEditor && editingClip && (
          <EditorScreen
            clip={editingClip}
            onBack={() =>
              navigate(
                selectedBatchJob ? `/batch/${selectedBatchJob.id}` : '/shorts'
              )
            }
            onClipUpdated={handleClipUpdated}
          />
        )}

        {isEditor && !editingClip && (
          <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            <div className="bg-cz-parchment border-2 border-cz-ink p-8 shadow-poster inline-block max-w-lg">
              <h3 className="font-display text-2xl tracking-wider uppercase mb-2">No Clip Selected</h3>
              <p className="font-mono text-xs text-cz-ink/70 mb-6">
                Choose a vertical short from the vault or a batch reel spool to open in the celluloid editor.
              </p>
              <button
                onClick={() => navigate('/shorts')}
                className="bg-cz-rust text-cz-paper px-6 py-2.5 font-display text-sm uppercase tracking-wider border-2 border-cz-ink shadow-poster hover:translate-x-0.5 hover:translate-y-0.5"
              >
                Go to Vault
              </button>
            </div>
          </div>
        )}

        {isHistory && (
          <HistoryScreen
            onOpenJob={handleOpenJobFromHistory}
            onOpenEditor={handleOpenEditor}
            onNavigateToCreate={() => navigate('/home')}
          />
        )}

        {isAccounts && <AccountsScreen />}

        {isSettings && <SettingsScreen />}
      </main>



      {/* Poster Footer */}
      <footer className="border-t-2 border-cz-ink bg-cz-parchment py-6 text-xs text-cz-ink select-none">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
            <span className="font-display tracking-wider text-base text-cz-ink uppercase">Clipzilla</span>
            <span className="text-cz-ink/70 font-sans">The monster that devours long-form footage and stamps out viral shorts.</span>
          </div>
          <div className="text-cz-ink/80 font-sans text-[11px] font-bold flex flex-wrap items-center justify-center space-x-2">
            <span>Local-First</span>
            <span>&bull;</span>
            <span>100% Private On-Premise</span>
            <span>&bull;</span>
            <span>Open Source Celluloid</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

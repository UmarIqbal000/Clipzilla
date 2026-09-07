import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Youtube,
  Instagram,
  Facebook,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Disc,
  Link as LinkIcon,
  ToggleLeft,
  ToggleRight,
  Server,
  Info,
  Key,
  Eye,
  EyeOff,
  Save,
  Plus,
  X,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { apiGet, apiPost, apiDelete, apiPatch } from '../api/client';
import PillBadge from './PillBadge';

export default function AccountsScreen() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [connectingPlatform, setConnectingPlatform] = useState(null);

  // Credentials configuration state
  const [credStatus, setCredStatus] = useState({
    youtube: { has_credentials: false, client_id_preview: '' },
    meta: { has_credentials: false, app_id_preview: '' },
    aws: { has_credentials: false, s3_bucket: '', s3_region: 'us-east-1', access_key_preview: '' },
  });

  const [credForm, setCredForm] = useState({
    youtube_client_id: '',
    youtube_client_secret: '',
    meta_app_id: '',
    meta_app_secret: '',
    aws_access_key_id: '',
    aws_secret_access_key: '',
    aws_s3_bucket: '',
    aws_s3_region: 'us-east-1',
  });

  const [showSecrets, setShowSecrets] = useState({
    youtube: false,
    meta: false,
    aws: false,
  });

  const [savingCreds, setSavingCreds] = useState(false);
  const [activeCredTab, setActiveCredTab] = useState('youtube');

  // Direct Connect Modal state
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [directForm, setDirectForm] = useState({
    platform: 'youtube',
    account_name: '',
    account_handle: '',
    access_token: '',
    refresh_token: '',
    page_id: '',
    page_access_token: '',
    ig_user_id: '',
  });
  const [submittingDirect, setSubmittingDirect] = useState(false);

  // Missing Credential Setup Modal
  const [missingCredPlatform, setMissingCredPlatform] = useState(null);

  const pollIntervalRef = useRef(null);
  const connectingPlatformRef = useRef(null);
  const redirectUriRef = useRef('http://localhost:8000/social-accounts/oauth/callback');
  const credsSectionRef = useRef(null);

  useEffect(() => {
    fetchAccounts();
    fetchCredentialsStatus();

    const handleMessage = async (event) => {
      if (event.data && event.data.type === 'CLIPZILLA_OAUTH_CALLBACK') {
        const { code } = event.data;
        const platform = connectingPlatformRef.current;
        if (code && platform) {
          try {
            await apiPost(`/social-accounts/oauth/${platform}/complete`, {
              code,
              redirect_uri: redirectUriRef.current,
            });
            stopPolling();
            setConnectingPlatform(null);
            connectingPlatformRef.current = null;
            showSuccess(`Successfully authorized and connected ${platform.toUpperCase()} account!`);
            fetchAccounts(true);
          } catch (err) {
            setError(err.message || `Failed to complete ${platform} authorization.`);
            setConnectingPlatform(null);
            connectingPlatformRef.current = null;
            stopPolling();
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      stopPolling();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const fetchAccounts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiGet('/social-accounts');
      const list = Array.isArray(data) ? data : (data?.accounts || []);
      setAccounts(list);
      return list;
    } catch (err) {
      setError(err.message || 'Error fetching connected accounts.');
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchCredentialsStatus = async () => {
    try {
      const data = await apiGet('/social-accounts/credentials/status');
      if (data) {
        setCredStatus(data);
        if (data.aws?.s3_bucket) {
          setCredForm(prev => ({
            ...prev,
            aws_s3_bucket: data.aws.s3_bucket,
            aws_s3_region: data.aws.s3_region || 'us-east-1',
          }));
        }
      }
    } catch (err) {
      console.warn('Could not fetch credentials status:', err);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const startPolling = (platform, initialCount) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const currentData = await fetchAccounts(true);
        if (currentData) {
          const newPlatformAccounts = currentData.filter((a) => a.platform === platform);
          if (newPlatformAccounts.length > initialCount) {
            stopPolling();
            setConnectingPlatform(null);
            connectingPlatformRef.current = null;
            showSuccess(`Successfully connected ${platform.toUpperCase()} account!`);
          }
        }
      } catch (e) {}
    }, 3000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleConnect = async (platform) => {
    // Check if credentials exist for platform
    const hasCreds =
      platform === 'youtube'
        ? credStatus.youtube?.has_credentials
        : credStatus.meta?.has_credentials;

    if (!hasCreds) {
      // Show setup modal so user can input credentials right on the dashboard
      setMissingCredPlatform(platform);
      setActiveCredTab(platform === 'youtube' ? 'youtube' : 'meta');
      return;
    }

    setConnectingPlatform(platform);
    connectingPlatformRef.current = platform;
    setError('');

    try {
      const initialCount = accounts.filter((a) => a.platform === platform).length;

      const res = await apiPost(`/social-accounts/oauth/${platform}/start`);
      const authUrl = res?.auth_url || res?.url;
      if (res?.redirect_uri) {
        redirectUriRef.current = res.redirect_uri;
      }
      if (authUrl) {
        window.open(authUrl, '_blank', 'width=600,height=700');
        startPolling(platform, initialCount);
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (err) {
      setError(err.message || `Error starting ${platform} connection.`);
      setConnectingPlatform(null);
      connectingPlatformRef.current = null;
    }
  };

  const handleSaveCredentials = async (e) => {
    if (e) e.preventDefault();
    setSavingCreds(true);
    setError('');

    try {
      await apiPost('/social-accounts/credentials', credForm);
      showSuccess('Credentials saved successfully and loaded into Clipzilla!');
      await fetchCredentialsStatus();

      // Clear secrets from inputs for safety while status shows configured
      setCredForm(prev => ({
        ...prev,
        youtube_client_secret: '',
        meta_app_secret: '',
        aws_secret_access_key: '',
      }));

      if (missingCredPlatform) {
        const platformToRetry = missingCredPlatform;
        setMissingCredPlatform(null);
        setTimeout(() => handleConnect(platformToRetry), 300);
      }
    } catch (err) {
      setError(err.message || 'Failed to save credentials.');
    } finally {
      setSavingCreds(false);
    }
  };

  const handleDirectConnectSubmit = async (e) => {
    e.preventDefault();
    setSubmittingDirect(true);
    setError('');

    try {
      await apiPost('/social-accounts/direct-connect', directForm);
      showSuccess(`Connected ${directForm.account_name} (${directForm.platform}) successfully!`);
      setIsDirectModalOpen(false);
      setDirectForm({
        platform: 'youtube',
        account_name: '',
        account_handle: '',
        access_token: '',
        refresh_token: '',
        page_id: '',
        page_access_token: '',
        ig_user_id: '',
      });
      fetchAccounts(true);
    } catch (err) {
      setError(err.message || 'Failed to directly connect account.');
    } finally {
      setSubmittingDirect(false);
    }
  };

  const handleToggleActive = async (account) => {
    try {
      await apiPatch(`/social-accounts/${account.id}`, { is_active: !account.is_active });
      showSuccess(`Account ${account.is_active ? 'deactivated' : 'activated'}.`);
      fetchAccounts(true);
    } catch (err) {
      setError(err.message || 'Error updating account status.');
    }
  };

  const handleDelete = async (account) => {
    if (!window.confirm(`Are you sure you want to disconnect ${account.account_name}?`)) return;

    try {
      await apiDelete(`/social-accounts/${account.id}`);
      showSuccess('Account disconnected.');
      fetchAccounts(true);
    } catch (err) {
      setError(err.message || 'Error disconnecting account.');
    }
  };

  const getPlatformIcon = (platform, className = 'w-5 h-5') => {
    switch (platform?.toLowerCase()) {
      case 'youtube': return <Youtube className={className} />;
      case 'instagram': return <Instagram className={className} />;
      case 'facebook': return <Facebook className={className} />;
      default: return <LinkIcon className={className} />;
    }
  };

  const getPlatformColor = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'youtube': return '#FF0000';
      case 'instagram': return '#E4405F';
      case 'facebook': return '#1877F2';
      default: return '#18140F';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays} days ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const isTokenExpiringSoon = (expiresAtStr) => {
    if (!expiresAtStr) return false;
    try {
      const expiresAt = new Date(expiresAtStr);
      const now = new Date();
      const diffTime = expiresAt - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays > 0;
    } catch {
      return false;
    }
  };

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.platform]) acc[account.platform] = [];
    acc[account.platform].push(account);
    return acc;
  }, {});

  const platformsToConnect = [
    {
      id: 'youtube',
      name: 'YouTube',
      icon: Youtube,
      color: '#FF0000',
      tagline: 'Upload Shorts with auto-tagging',
      isConfigured: credStatus.youtube?.has_credentials,
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: Instagram,
      color: '#E4405F',
      tagline: 'Publish Reels to IG Business / Creator',
      isConfigured: credStatus.meta?.has_credentials,
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      color: '#1877F2',
      tagline: 'Publish Reels to Facebook Pages',
      isConfigured: credStatus.meta?.has_credentials,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b-2 border-cz-ink">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 bg-cz-parchment border-2 border-cz-ink flex items-center justify-center text-cz-rust shadow-[2px_2px_0px_#18140F]">
            <LinkIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-cz-ink uppercase leading-none">
              SOCIAL <span className="font-serif italic font-normal text-cz-moss lowercase tracking-normal">accounts</span>.
            </h2>
            <p className="text-xs text-cz-ink/70 mt-1">
              Configure credentials and connect multiple platform accounts to publish shorts directly
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              credsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 bg-cz-paper hover:bg-cz-parchment border-2 border-cz-ink text-xs font-bold uppercase tracking-wider text-cz-ink shadow-[2px_2px_0px_#18140F] flex items-center space-x-1.5 cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-cz-rust" />
            <span>Setup Credentials</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDirectModalOpen(true)}
            className="px-3 py-1.5 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper border-2 border-cz-ink text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_#18140F] flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Token Manually</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="mb-6 p-4 bg-cz-paper border-2 border-cz-moss text-cz-moss text-xs flex items-center space-x-2 font-bold shadow-[2px_2px_0px_#2F4B3C]">
          <CheckCircle2 className="w-4 h-4 text-cz-moss shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="mb-6 p-6 bg-cz-parchment border-2 border-cz-rust shadow-[4px_4px_0px_#C1502E]">
          <div className="flex items-start space-x-3.5">
            <AlertCircle className="w-6 h-6 text-cz-rust shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-display text-2xl tracking-wider text-cz-ink uppercase mb-1">
                ERROR NOTICE
              </h4>
              <p className="text-xs text-cz-ink/80 leading-relaxed max-w-xl">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="p-1 hover:bg-cz-rust hover:text-cz-paper border border-cz-ink text-cz-ink"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Section 1: Connect New Account */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-2xl tracking-tight text-cz-ink uppercase">
            CONNECT NEW PLATFORM
          </h3>
          <span className="text-xs text-cz-ink/60 font-mono">
            OAuth 2.0 Direct Integration
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {platformsToConnect.map((platform) => {
            const isConnecting = connectingPlatform === platform.id;
            return (
              <div
                key={platform.id}
                className="bg-cz-parchment border-2 border-cz-ink p-5 shadow-[4px_4px_0px_#18140F] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-12 h-12 flex items-center justify-center border-2 border-cz-ink bg-cz-paper shadow-[2px_2px_0px_#18140F]"
                      style={{ color: platform.color }}
                    >
                      <platform.icon className="w-6 h-6" />
                    </div>
                    {platform.isConfigured ? (
                      <span className="text-[10px] px-2 py-0.5 bg-cz-moss text-cz-paper border border-cz-ink font-bold uppercase tracking-wider flex items-center space-x-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-cz-paper text-cz-rust border border-cz-rust font-bold uppercase tracking-wider flex items-center space-x-1">
                        <Key className="w-3 h-3" />
                        <span>Setup Needed</span>
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-cz-ink text-lg mb-1">{platform.name}</h4>
                  <p className="text-xs text-cz-ink/70 mb-4 leading-relaxed">
                    {platform.tagline}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-cz-ink/10">
                  <button
                    type="button"
                    onClick={() => handleConnect(platform.id)}
                    disabled={isConnecting}
                    className="w-full px-4 py-2 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper text-xs font-bold uppercase tracking-wider border-2 border-cz-ink shadow-[2px_2px_0px_#18140F] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isConnecting ? (
                      <>
                        <Disc className="w-4 h-4 animate-reel-spin" />
                        <span>Authorizing...</span>
                      </>
                    ) : platform.isConfigured ? (
                      <span>Connect {platform.name}</span>
                    ) : (
                      <span>Set Up & Connect</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCredTab(platform.id === 'youtube' ? 'youtube' : 'meta');
                      credsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full text-center text-[10px] text-cz-ink/70 hover:text-cz-rust font-bold uppercase tracking-wider py-0.5 hover:underline"
                  >
                    ⚙ Configure API Keys
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Platform Credentials Form (Enter Here on Dashboard) */}
      <div ref={credsSectionRef} className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-cz-rust" />
            <h3 className="font-display text-2xl tracking-tight text-cz-ink uppercase">
              CREDENTIALS & API SETUP (DASHBOARD)
            </h3>
          </div>
          <span className="text-xs text-cz-moss font-bold bg-cz-paper px-2.5 py-1 border border-cz-ink shadow-[1px_1px_0px_#18140F]">
            Saved securely in your environment
          </span>
        </div>

        <div className="bg-cz-parchment border-2 border-cz-ink shadow-[4px_4px_0px_#18140F]">
          {/* Tab Selector - 3 Equal Width Tabs */}
          <div className="bg-cz-paper border-b-2 border-cz-ink grid grid-cols-1 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveCredTab('youtube')}
              className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border-b-2 md:border-b-0 md:border-r-2 border-cz-ink transition-colors cursor-pointer ${
                activeCredTab === 'youtube'
                  ? 'bg-cz-parchment text-cz-ink relative z-10 md:border-b-2 md:border-b-cz-parchment md:-mb-[2px]'
                  : 'text-cz-ink/70 hover:bg-cz-parchment/60'
              }`}
            >
              <Youtube className="w-4 h-4 text-red-600 shrink-0" />
              <span>Google / YouTube</span>
              {credStatus.youtube?.has_credentials && (
                <span className="w-2 h-2 rounded-full bg-cz-moss shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCredTab('meta')}
              className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border-b-2 md:border-b-0 md:border-r-2 border-cz-ink transition-colors cursor-pointer ${
                activeCredTab === 'meta'
                  ? 'bg-cz-parchment text-cz-ink relative z-10 md:border-b-2 md:border-b-cz-parchment md:-mb-[2px]'
                  : 'text-cz-ink/70 hover:bg-cz-parchment/60'
              }`}
            >
              <Instagram className="w-4 h-4 text-pink-600 shrink-0" />
              <span>Meta (Instagram & Facebook)</span>
              {credStatus.meta?.has_credentials && (
                <span className="w-2 h-2 rounded-full bg-cz-moss shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCredTab('aws')}
              className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors cursor-pointer ${
                activeCredTab === 'aws'
                  ? 'bg-cz-parchment text-cz-ink relative z-10 md:border-b-2 md:border-b-cz-parchment md:-mb-[2px]'
                  : 'text-cz-ink/70 hover:bg-cz-parchment/60'
              }`}
            >
              <Server className="w-4 h-4 text-cz-ink shrink-0" />
              <span>AWS S3 (Video Delivery)</span>
              {credStatus.aws?.has_credentials && (
                <span className="w-2 h-2 rounded-full bg-cz-moss shrink-0" />
              )}
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSaveCredentials} className="p-6 space-y-6">
            {/* YouTube Tab */}
            {activeCredTab === 'youtube' && (
              <div className="space-y-4">
                <div className="p-3 bg-cz-paper border border-cz-ink text-xs flex items-start space-x-2">
                  <Info className="w-4 h-4 text-cz-rust shrink-0 mt-0.5" />
                  <div className="text-cz-ink/80 space-y-1">
                    <p className="font-bold">Google Cloud Console Setup:</p>
                    <p>
                      1. Go to Google Cloud Console → APIs &amp; Services → Credentials.
                    </p>
                    <p>
                      2. Create an <strong>OAuth 2.0 Client ID</strong> (Application type: <em>Web application</em>).
                    </p>
                    <p>
                      3. Set Authorized redirect URI to:{' '}
                      <code className="bg-cz-parchment px-1.5 py-0.5 border border-cz-ink font-mono font-bold text-cz-rust select-all">
                        http://localhost:8000/social-accounts/oauth/callback
                      </code>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-cz-ink uppercase mb-1">
                      YouTube Client ID
                    </label>
                    <input
                      type="text"
                      placeholder={credStatus.youtube?.client_id_preview || 'e.g. 123456789.apps.googleusercontent.com'}
                      value={credForm.youtube_client_id}
                      onChange={(e) =>
                        setCredForm({ ...credForm, youtube_client_id: e.target.value })
                      }
                      className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none focus:border-cz-rust"
                    />
                    {credStatus.youtube?.client_id_preview && (
                      <p className="text-[10px] text-cz-moss font-mono mt-1">
                        Currently saved: {credStatus.youtube.client_id_preview}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-cz-ink uppercase mb-1 flex items-center justify-between">
                      <span>YouTube Client Secret</span>
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecrets({ ...showSecrets, youtube: !showSecrets.youtube })
                        }
                        className="text-[10px] text-cz-ink/60 hover:text-cz-ink flex items-center space-x-1"
                      >
                        {showSecrets.youtube ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showSecrets.youtube ? 'Hide' : 'Show'}</span>
                      </button>
                    </label>
                    <input
                      type={showSecrets.youtube ? 'text' : 'password'}
                      placeholder={credStatus.youtube?.has_client_secret ? '•••••••••••••••• (saved)' : 'Enter Client Secret'}
                      value={credForm.youtube_client_secret}
                      onChange={(e) =>
                        setCredForm({ ...credForm, youtube_client_secret: e.target.value })
                      }
                      className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none focus:border-cz-rust"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Meta Tab */}
            {activeCredTab === 'meta' && (
              <div className="space-y-4">
                <div className="p-3 bg-cz-paper border border-cz-ink text-xs flex items-start space-x-2">
                  <Info className="w-4 h-4 text-cz-rust shrink-0 mt-0.5" />
                  <div className="text-cz-ink/80 space-y-1">
                    <p className="font-bold">Meta for Developers Setup:</p>
                    <p>
                      1. Go to developers.facebook.com and create or open your app.
                    </p>
                    <p>
                      2. Add <strong>Instagram Graph API</strong> and <strong>Facebook Login</strong> products.
                    </p>
                    <p>
                      3. In App Settings → Basic, copy your <strong>App ID</strong> and <strong>App Secret</strong>.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-cz-ink uppercase mb-1">
                      Meta App ID
                    </label>
                    <input
                      type="text"
                      placeholder={credStatus.meta?.app_id_preview || 'e.g. 1592837482910'}
                      value={credForm.meta_app_id}
                      onChange={(e) =>
                        setCredForm({ ...credForm, meta_app_id: e.target.value })
                      }
                      className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none focus:border-cz-rust"
                    />
                    {credStatus.meta?.app_id_preview && (
                      <p className="text-[10px] text-cz-moss font-mono mt-1">
                        Currently saved: {credStatus.meta.app_id_preview}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-cz-ink uppercase mb-1 flex items-center justify-between">
                      <span>Meta App Secret</span>
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecrets({ ...showSecrets, meta: !showSecrets.meta })
                        }
                        className="text-[10px] text-cz-ink/60 hover:text-cz-ink flex items-center space-x-1"
                      >
                        {showSecrets.meta ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showSecrets.meta ? 'Hide' : 'Show'}</span>
                      </button>
                    </label>
                    <input
                      type={showSecrets.meta ? 'text' : 'password'}
                      placeholder={credStatus.meta?.has_app_secret ? '•••••••••••••••• (saved)' : 'Enter App Secret'}
                      value={credForm.meta_app_secret}
                      onChange={(e) =>
                        setCredForm({ ...credForm, meta_app_secret: e.target.value })
                      }
                      className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none focus:border-cz-rust"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* AWS S3 Tab */}
            {activeCredTab === 'aws' && (
              <div className="space-y-4">
                <div className="p-3 bg-cz-paper border border-cz-ink text-xs flex items-start space-x-2">
                  <Server className="w-4 h-4 text-cz-rust shrink-0 mt-0.5" />
                  <div className="text-cz-ink/80 space-y-1">
                    <p className="font-bold">AWS S3 Video Delivery Setup:</p>
                    <p>
                      Instagram Reels and Facebook Graph APIs require video files to be hosted at a public HTTPS URL.
                      Clipzilla temporarily uploads the rendered clip to your S3 bucket and generates a 1-hour pre-signed URL for the platform to ingest, automatically deleting it afterward.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-cz-ink uppercase mb-1">
                      AWS Access Key ID
                    </label>
                    <input
                      type="text"
                      placeholder={credStatus.aws?.access_key_preview || 'e.g. AKIAIOSFODNN7EXAMPLE'}
                      value={credForm.aws_access_key_id}
                      onChange={(e) =>
                        setCredForm({ ...credForm, aws_access_key_id: e.target.value })
                      }
                      className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none focus:border-cz-rust"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-cz-ink uppercase mb-1 flex items-center justify-between">
                      <span>AWS Secret Access Key</span>
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecrets({ ...showSecrets, aws: !showSecrets.aws })
                        }
                        className="text-[10px] text-cz-ink/60 hover:text-cz-ink flex items-center space-x-1"
                      >
                        {showSecrets.aws ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showSecrets.aws ? 'Hide' : 'Show'}</span>
                      </button>
                    </label>
                    <input
                      type={showSecrets.aws ? 'text' : 'password'}
                      placeholder={credStatus.aws?.has_secret_key ? '•••••••••••••••• (saved)' : 'Enter Secret Access Key'}
                      value={credForm.aws_secret_access_key}
                      onChange={(e) =>
                        setCredForm({ ...credForm, aws_secret_access_key: e.target.value })
                      }
                      className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none focus:border-cz-rust"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-cz-ink uppercase mb-1">
                      S3 Bucket Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. clipzilla-video-temp"
                      value={credForm.aws_s3_bucket}
                      onChange={(e) =>
                        setCredForm({ ...credForm, aws_s3_bucket: e.target.value })
                      }
                      className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none focus:border-cz-rust"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-cz-ink uppercase mb-1">
                      AWS Region
                    </label>
                    <input
                      type="text"
                      placeholder="us-east-1"
                      value={credForm.aws_s3_region}
                      onChange={(e) =>
                        setCredForm({ ...credForm, aws_s3_region: e.target.value })
                      }
                      className="w-full bg-cz-paper border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none focus:border-cz-rust"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4 border-t-2 border-cz-ink/10 flex items-center justify-between">
              <span className="text-xs text-cz-ink/70">
                Changes take effect immediately across all background publish tasks.
              </span>
              <button
                type="submit"
                disabled={savingCreds}
                className="px-6 py-2.5 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper border-2 border-cz-ink text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_#18140F] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
              >
                {savingCreds ? (
                  <>
                    <Disc className="w-4 h-4 animate-reel-spin" />
                    <span>Saving to Dashboard...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Credentials to Dashboard</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Section 3: Your Connected Accounts */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center space-x-3">
            <h3 className="font-display text-2xl tracking-tight text-cz-ink uppercase">
              YOUR CONNECTED ACCOUNTS
            </h3>
            <span className="text-xs font-bold text-cz-ink/70 font-mono bg-cz-paper px-2 py-0.5 border border-cz-ink">
              {accounts.length} account{accounts.length === 1 ? '' : 's'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsDirectModalOpen(true)}
            className="px-3 py-1.5 bg-cz-paper hover:bg-cz-parchment border-2 border-cz-ink text-xs font-bold text-cz-ink shadow-[2px_2px_0px_#18140F] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <span>+ Add Token Manually</span>
          </button>
        </div>

        {loading && !connectingPlatform ? (
          <div className="py-10 text-center bg-cz-parchment border-2 border-cz-ink shadow-[4px_4px_0px_#18140F] p-8">
            <div className="w-8 h-8 bg-cz-paper border-2 border-cz-ink flex items-center justify-center mx-auto mb-3 text-cz-rust shadow-[2px_2px_0px_#18140F]">
              <Disc className="w-4 h-4 animate-reel-spin" />
            </div>
            <p className="font-display text-xl tracking-tight text-cz-ink uppercase">
              LOADING ACCOUNTS...
            </p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 bg-cz-parchment border-2 border-cz-ink p-8 shadow-[4px_4px_0px_#18140F]">
            <LinkIcon className="w-10 h-10 text-cz-rust mx-auto mb-3" />
            <p className="text-sm font-bold text-cz-ink mb-2">No accounts connected yet.</p>
            <p className="text-xs text-cz-ink/70 mb-4 max-w-sm mx-auto">
              Save your API credentials above, then click Connect on any platform or add an account with a token manually.
            </p>
            <button
              type="button"
              onClick={() => setIsDirectModalOpen(true)}
              className="px-4 py-2 bg-cz-paper hover:bg-cz-parchment border-2 border-cz-ink text-xs font-bold text-cz-ink shadow-[2px_2px_0px_#18140F]"
            >
              + Add Account via Direct Token
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAccounts).map(([platform, platformAccounts]) => (
              <div
                key={platform}
                className="bg-cz-parchment border-2 border-cz-ink shadow-[4px_4px_0px_#18140F]"
              >
                <div className="bg-cz-paper border-b-2 border-cz-ink px-4 py-2 flex items-center space-x-2">
                  <div style={{ color: getPlatformColor(platform) }}>
                    {getPlatformIcon(platform, 'w-5 h-5')}
                  </div>
                  <h4 className="font-display tracking-wider text-xl uppercase text-cz-ink">
                    {platform}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-cz-parchment border border-cz-ink">
                    {platformAccounts.length} channel{platformAccounts.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="divide-y-2 divide-cz-parchment-border">
                  {platformAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                        account.is_active ? 'hover:bg-cz-paper/40' : 'bg-cz-parchment opacity-75'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-bold text-base text-cz-ink truncate">
                            {account.account_name}
                          </span>
                          {!account.is_active && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-cz-ink text-cz-paper font-bold uppercase">
                              Inactive
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3 text-xs text-cz-ink/70">
                          <span className="font-medium">@{account.account_handle || 'account'}</span>
                          <span>&bull;</span>
                          <span>Connected {formatDate(account.created_at)}</span>
                        </div>

                        {isTokenExpiringSoon(account.token_expires_at) && (
                          <div className="mt-2 flex items-center space-x-1 text-cz-rust text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3" />
                            <span>Authorization expiring soon. Please reconnect.</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 shrink-0 border-t sm:border-t-0 border-cz-ink/20 pt-3 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(account)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-cz-paper hover:bg-cz-parchment border-2 border-cz-ink text-cz-ink text-xs font-bold transition-colors cursor-pointer shadow-[1px_1px_0px_#18140F]"
                        >
                          {account.is_active ? (
                            <>
                              <ToggleRight className="w-4 h-4 text-cz-moss" /> <span>Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 text-cz-ink/50" /> <span>Paused</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(account)}
                          className="p-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-ink text-cz-ink transition-colors cursor-pointer shadow-[1px_1px_0px_#18140F]"
                          title="Disconnect Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Direct Token Connect Modal */}
      {isDirectModalOpen && (
        <div className="fixed inset-0 z-50 bg-cz-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cz-paper border-2 border-cz-ink w-full max-w-lg shadow-[6px_6px_0px_#18140F] flex flex-col">
            <div className="flex items-center justify-between p-4 bg-cz-parchment border-b-2 border-cz-ink">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-cz-rust" />
                <h3 className="font-display text-xl uppercase tracking-wider text-cz-ink">
                  DIRECT TOKEN ACCOUNT CONNECT
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectModalOpen(false)}
                className="p-1 hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-ink text-cz-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDirectConnectSubmit} className="p-5 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                  Destination Platform
                </label>
                <select
                  value={directForm.platform}
                  onChange={(e) => setDirectForm({ ...directForm, platform: e.target.value })}
                  className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-bold text-cz-ink focus:outline-none"
                >
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                  Channel / Account Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Shorts Channel"
                  value={directForm.account_name}
                  onChange={(e) => setDirectForm({ ...directForm, account_name: e.target.value })}
                  className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                  Account Handle (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. @myshorts"
                  value={directForm.account_handle}
                  onChange={(e) => setDirectForm({ ...directForm, account_handle: e.target.value })}
                  className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none"
                />
              </div>

              {directForm.platform === 'youtube' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                      OAuth Access Token
                    </label>
                    <input
                      type="password"
                      placeholder="ya29.a0Ac..."
                      value={directForm.access_token}
                      onChange={(e) => setDirectForm({ ...directForm, access_token: e.target.value })}
                      className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                      OAuth Refresh Token (for auto-renewal)
                    </label>
                    <input
                      type="password"
                      placeholder="1//0g..."
                      value={directForm.refresh_token}
                      onChange={(e) => setDirectForm({ ...directForm, refresh_token: e.target.value })}
                      className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none"
                    />
                  </div>
                </>
              )}

              {directForm.platform === 'instagram' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                      Instagram Business Account ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 17841400000000000"
                      value={directForm.ig_user_id}
                      onChange={(e) => setDirectForm({ ...directForm, ig_user_id: e.target.value })}
                      className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                      User / Page Access Token
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="EAAB..."
                      value={directForm.access_token}
                      onChange={(e) => setDirectForm({ ...directForm, access_token: e.target.value })}
                      className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none"
                    />
                  </div>
                </>
              )}

              {directForm.platform === 'facebook' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                      Facebook Page ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1029384756"
                      value={directForm.page_id}
                      onChange={(e) => setDirectForm({ ...directForm, page_id: e.target.value })}
                      className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                      Facebook Page Access Token
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="EAAB..."
                      value={directForm.page_access_token}
                      onChange={(e) => setDirectForm({ ...directForm, page_access_token: e.target.value })}
                      className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t-2 border-cz-ink/10 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsDirectModalOpen(false)}
                  className="px-3 py-2 bg-cz-parchment border-2 border-cz-ink text-cz-ink font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDirect}
                  className="px-5 py-2 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper font-bold uppercase tracking-wider border-2 border-cz-ink shadow-[2px_2px_0px_#18140F] disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {submittingDirect ? (
                    <>
                      <Disc className="w-3.5 h-3.5 animate-reel-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Save &amp; Connect Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Missing Credential Prompt Modal */}
      {missingCredPlatform && (
        <div className="fixed inset-0 z-50 bg-cz-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cz-paper border-2 border-cz-ink w-full max-w-lg shadow-[6px_6px_0px_#18140F]">
            <div className="p-4 bg-cz-parchment border-b-2 border-cz-ink flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-cz-rust" />
                <h3 className="font-display text-xl uppercase tracking-wider text-cz-ink">
                  SET UP {missingCredPlatform.toUpperCase()} CREDENTIALS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMissingCredPlatform(null)}
                className="p-1 hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-ink text-cz-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-sans">
              <p className="text-cz-ink/80">
                To connect a <strong>{missingCredPlatform}</strong> account, please provide your app credentials here. They will be saved directly on your dashboard.
              </p>

              {missingCredPlatform === 'youtube' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                      YouTube Client ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 12345.apps.googleusercontent.com"
                      value={credForm.youtube_client_id}
                      onChange={(e) =>
                        setCredForm({ ...credForm, youtube_client_id: e.target.value })
                      }
                      className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                      YouTube Client Secret
                    </label>
                    <input
                      type="password"
                      placeholder="Enter secret"
                      value={credForm.youtube_client_secret}
                      onChange={(e) =>
                        setCredForm({ ...credForm, youtube_client_secret: e.target.value })
                      }
                      className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                      Meta App ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1592837482910"
                      value={credForm.meta_app_id}
                      onChange={(e) =>
                        setCredForm({ ...credForm, meta_app_id: e.target.value })
                      }
                      className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-cz-ink uppercase mb-1">
                      Meta App Secret
                    </label>
                    <input
                      type="password"
                      placeholder="Enter secret"
                      value={credForm.meta_app_secret}
                      onChange={(e) =>
                        setCredForm({ ...credForm, meta_app_secret: e.target.value })
                      }
                      className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs font-mono text-cz-ink focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t-2 border-cz-ink/10 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setMissingCredPlatform(null)}
                  className="px-3 py-2 bg-cz-parchment border-2 border-cz-ink text-cz-ink font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCredentials}
                  disabled={savingCreds}
                  className="px-5 py-2 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper font-bold uppercase tracking-wider border-2 border-cz-ink shadow-[2px_2px_0px_#18140F] disabled:opacity-50"
                >
                  {savingCreds ? 'Saving...' : 'Save & Continue to Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

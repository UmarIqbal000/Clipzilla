import React, { useState, useEffect } from 'react';
import {
  Settings,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Key,
  Server,
  Cpu,
  Plus,
  Trash2,
  Edit3,
  Star,
  X,
  Radio,
  Disc,
} from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../api/client';

const PROVIDER_DEFAULTS = {
  ollama_local: {
    name: 'Ollama (Local Engine)',
    desc: 'Local offline inference on localhost:11434 with zero token cost.',
    defaultUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    needsKey: false,
  },
  ollama_cloud: {
    name: 'Ollama (Cloud Engine)',
    desc: 'Cloud-hosted high-speed models on ollama.com with API key authentication.',
    defaultUrl: 'https://ollama.com/v1',
    defaultModel: 'gpt-oss:120b',
    needsKey: true,
  },
  openai_compat: {
    name: 'OpenAI-Compatible (Groq, OpenRouter, LM Studio)',
    desc: 'Connect to any external OpenAI-compatible API endpoint.',
    defaultUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true,
  },
};

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [error, setError] = useState('');
  const [isConnError, setIsConnError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Modal / Form state for Add/Edit Profile
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    provider_type: 'ollama_cloud',
    base_url: 'https://ollama.com/v1',
    model: 'gpt-oss:120b',
    api_key: '',
    is_active: false,
  });
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    setError('');
    setIsConnError(false);
    try {
      const data = await apiGet('/settings/profiles');
      setProfiles(data?.profiles || []);
      setActiveProfileId(data?.active_profile || '');
    } catch (err) {
      setError(err.message || 'Error fetching AI provider engines.');
      setIsConnError(Boolean(err.isConnection));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    const defaultType = 'ollama_cloud';
    const meta = PROVIDER_DEFAULTS[defaultType];
    setFormData({
      id: '',
      name: 'Ollama Cloud - gpt-oss:120b',
      provider_type: defaultType,
      base_url: meta.defaultUrl,
      model: meta.defaultModel,
      api_key: '',
      is_active: false,
    });
    setShowKey(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (profile) => {
    setModalMode('edit');
    setFormData({
      id: profile.id,
      name: profile.name,
      provider_type: profile.provider_type,
      base_url: profile.base_url,
      model: profile.model,
      api_key: '',
      is_active: profile.is_active,
    });
    setShowKey(false);
    setIsModalOpen(true);
  };

  const handleTypeChange = (type) => {
    const meta = PROVIDER_DEFAULTS[type] || PROVIDER_DEFAULTS.ollama_local;
    setFormData((prev) => ({
      ...prev,
      provider_type: type,
      base_url: prev.base_url === PROVIDER_DEFAULTS[prev.provider_type]?.defaultUrl ? meta.defaultUrl : prev.base_url,
      model: prev.model === PROVIDER_DEFAULTS[prev.provider_type]?.defaultModel ? meta.defaultModel : prev.model,
    }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const updated = await apiPost('/settings/profiles', formData);
      setProfiles(updated.profiles || []);
      setActiveProfileId(updated.active_profile || '');
      setIsModalOpen(false);
      setSuccessMsg(modalMode === 'add' ? 'Engine profile added to chamber.' : 'Engine profile updated.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Error saving engine profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!window.confirm(`Are you sure you want to remove engine profile "${profileId}"?`)) return;

    setError('');
    try {
      const updated = await apiDelete(`/settings/profiles/${encodeURIComponent(profileId)}`);
      setProfiles(updated.profiles || []);
      setActiveProfileId(updated.active_profile || '');
      setSuccessMsg('Engine profile removed.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Error removing engine profile.');
    }
  };

  const handleSetActive = async (profileId) => {
    try {
      const updated = await apiPost('/settings/active-profile', { profile_id: profileId });
      setProfiles(updated.profiles || []);
      setActiveProfileId(updated.active_profile || '');
      setSuccessMsg(`Default engine switched to "${profileId}"`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Error switching active engine.');
    }
  };

  const currentMeta = PROVIDER_DEFAULTS[formData.provider_type] || PROVIDER_DEFAULTS.openai_compat;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-5 border-b border-cz-border">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded bg-cz-surface border border-cz-border flex items-center justify-center text-cz-ember shadow-inner">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-cz-bone uppercase leading-none">
              AI PROVIDER ENGINES
            </h2>
            <p className="text-xs text-cz-muted font-sans mt-1">
              Configure LLM retention models (Ollama Cloud, Ollama Local, Groq) and set job defaults
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded bg-cz-ember hover:bg-cz-ember-hover text-cz-bone text-xs font-bold uppercase tracking-wider shadow-[0_2px_0_0_#9a2b05] active:translate-y-[1px] transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Engine Profile</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="mb-6 p-4 rounded bg-cz-surface border border-cz-sensor/50 text-cz-bone text-xs flex items-center space-x-2 font-sans">
          <CheckCircle2 className="w-4 h-4 text-cz-sensor shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error / Offline Banner */}
      {error && (
        <div className="mb-6 p-5 rounded-lg bg-cz-surface border border-rose-900/80 shadow-xl">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-cz-bone font-sans mb-1">
                {isConnError ? 'Clipzilla Processing Engine Offline' : 'Engine Configuration Error'}
              </h4>
              <p className="text-xs text-cz-muted font-sans leading-relaxed mb-3">
                {error}
              </p>
              <button
                type="button"
                onClick={fetchProfiles}
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
          <div className="w-12 h-12 rounded bg-cz-surface border border-cz-border flex items-center justify-center mx-auto mb-4 text-cz-muted">
            <Disc className="w-6 h-6 text-cz-ember animate-reel-spin" />
          </div>
          <p className="font-display text-xl tracking-wider text-cz-bone uppercase">
            CONNECTING TO ENGINE DECK...
          </p>
          <p className="text-xs text-cz-muted font-sans mt-1">Reading provider credentials</p>
        </div>
      ) : profiles.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 bg-cz-surface border border-cz-border rounded-lg max-w-lg mx-auto p-8 relative overflow-hidden shadow-2xl">
          <Cpu className="w-8 h-8 text-cz-ember mx-auto mb-4" />
          <h3 className="font-display text-2xl text-cz-bone uppercase mb-2">No Engines Configured</h3>
          <p className="text-xs text-cz-muted mb-6 font-sans">
            Add an AI provider profile (e.g. Ollama Cloud or Local) to run video retention analysis.
          </p>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 rounded bg-cz-ember hover:bg-cz-ember-hover text-cz-bone text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Create Engine Profile
          </button>
        </div>
      ) : (
        /* Profiles Cards Grid */
        <div className="space-y-4">
          {profiles.map((p) => {
            const isActive = p.id === activeProfileId;

            return (
              <div
                key={p.id}
                className={`rounded-lg p-5 border transition-all relative overflow-hidden ${
                  isActive
                    ? 'bg-cz-ember-subtle border-cz-ember shadow-md shadow-cz-ember/10 ring-1 ring-cz-ember'
                    : 'bg-cz-surface border-cz-border hover:border-cz-muted/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left Side: Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center space-x-2.5">
                      <span className="font-bold text-sm sm:text-base text-cz-bone font-sans">
                        {p.name}
                      </span>

                      {isActive && (
                        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-cz-base border border-cz-sensor/40 text-cz-sensor text-[10px] font-bold uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-cz-sensor" />
                          <span>Active Default</span>
                        </span>
                      )}

                      <span className="text-[10px] px-2 py-0.5 rounded bg-cz-base border border-cz-border text-cz-muted uppercase tracking-wider">
                        {p.provider_type}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cz-muted font-sans">
                      <span>Model: <strong className="text-cz-bone font-medium">{p.model}</strong></span>
                      <span>/</span>
                      <span className="truncate max-w-sm">Base URL: {p.base_url}</span>
                      {p.requires_api_key && (
                        <>
                          <span>/</span>
                          <span className={p.has_api_key ? 'text-cz-sensor font-medium' : 'text-amber-400 font-medium'}>
                            {p.has_api_key ? 'Key Configured' : 'Key Missing'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Actions */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => handleSetActive(p.id)}
                        className="px-3 py-1.5 rounded bg-cz-base hover:bg-cz-raised border border-cz-border text-cz-bone hover:text-cz-ember text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Set Default
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(p)}
                      className="p-1.5 rounded bg-cz-base hover:bg-cz-raised border border-cz-border text-cz-muted hover:text-cz-bone transition-colors cursor-pointer"
                      title="Edit Engine Parameters"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {profiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProfile(p.id)}
                        className="p-1.5 rounded bg-cz-base hover:bg-rose-950/60 border border-cz-border hover:border-rose-800 text-cz-muted hover:text-rose-300 transition-colors cursor-pointer"
                        title="Remove Engine Profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog for Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-cz-base/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cz-surface border border-cz-border rounded-lg max-w-lg w-full p-6 shadow-2xl relative overflow-hidden animate-shutter-snap">
            <div className="h-1.5 w-full sprocket-track-h opacity-40 absolute top-0 left-0 border-b border-cz-border/40" />

            <div className="flex items-center justify-between mb-5 border-b border-cz-border pb-3">
              <h3 className="font-display text-2xl tracking-wide text-cz-bone uppercase">
                {modalMode === 'add' ? 'REGISTER AI ENGINE' : 'UPDATE AI ENGINE'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-cz-muted hover:text-cz-bone p-1 rounded hover:bg-cz-raised cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-cz-bone uppercase tracking-wider mb-1">
                  Engine Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(PROVIDER_DEFAULTS).map(([key, def]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTypeChange(key)}
                      className={`p-2 rounded border text-center text-xs transition-all cursor-pointer ${
                        formData.provider_type === key
                          ? 'bg-cz-ember-subtle border-cz-ember text-cz-bone font-bold'
                          : 'bg-cz-base border-cz-border text-cz-muted hover:text-cz-bone'
                      }`}
                    >
                      {key === 'ollama_local' ? 'Local' : key === 'ollama_cloud' ? 'Ollama Cloud' : 'OpenAI Compat'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cz-bone uppercase tracking-wider mb-1">
                  Profile Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-cz-base border border-cz-border rounded px-3 py-2 text-xs text-cz-bone focus:outline-none focus:border-cz-ember font-sans"
                  placeholder="e.g. Ollama Cloud - gpt-oss:120b"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cz-bone uppercase tracking-wider mb-1">
                  Base API URL
                </label>
                <input
                  type="url"
                  required
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  className="w-full bg-cz-base border border-cz-border rounded px-3 py-2 text-xs text-cz-bone focus:outline-none focus:border-cz-ember font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cz-bone uppercase tracking-wider mb-1">
                  Model Identifier
                </label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full bg-cz-base border border-cz-border rounded px-3 py-2 text-xs text-cz-bone focus:outline-none focus:border-cz-ember font-sans"
                  placeholder="e.g. gpt-oss:120b or llama3.2"
                />
              </div>

              {currentMeta.needsKey && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-cz-bone uppercase tracking-wider">
                      Secret API Key
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="text-[11px] text-cz-muted hover:text-cz-bone flex items-center space-x-1 cursor-pointer"
                    >
                      {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showKey ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    className="w-full bg-cz-base border border-cz-border rounded px-3 py-2 text-xs text-cz-bone focus:outline-none focus:border-cz-ember font-sans"
                    placeholder={modalMode === 'edit' ? 'Leave blank to retain configured key' : 'Enter API Key...'}
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-cz-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded bg-cz-base hover:bg-cz-raised text-cz-muted hover:text-cz-bone border border-cz-border text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded bg-cz-ember hover:bg-cz-ember-hover text-cz-bone font-bold text-xs uppercase tracking-wider shadow-[0_2px_0_0_#9a2b05] cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Engine Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

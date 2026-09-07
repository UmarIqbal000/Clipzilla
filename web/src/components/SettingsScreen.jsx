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
import PillBadge from './PillBadge';

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
    <div className="max-w-5xl mx-auto py-8 px-4 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b-2 border-cz-ink">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 bg-cz-parchment border-2 border-cz-ink flex items-center justify-center text-cz-rust shadow-[2px_2px_0px_#18140F]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-cz-ink uppercase leading-none">
              AI PROVIDER <span className="font-serif italic font-normal text-cz-moss lowercase tracking-normal">engines</span>.
            </h2>
            <p className="text-xs text-cz-ink/70 mt-1">
              Configure retention LLM engines (Ollama Cloud, Ollama Local, Groq) and set job defaults
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper text-xs font-bold uppercase tracking-wider border-2 border-cz-ink shadow-[2px_2px_0px_#18140F] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add engine profile</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="mb-6 p-4 bg-cz-paper border-2 border-cz-moss text-cz-moss text-xs flex items-center space-x-2 font-bold shadow-[2px_2px_0px_#2F4B3C]">
          <CheckCircle2 className="w-4 h-4 text-cz-moss shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error / Offline Banner */}
      {error && (
        <div className="mb-6 p-6 bg-cz-parchment border-2 border-cz-rust shadow-[4px_4px_0px_#C1502E]">
          <div className="flex items-start space-x-3.5">
            <AlertCircle className="w-6 h-6 text-cz-rust shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-display text-2xl tracking-wider text-cz-ink uppercase mb-1">
                {isConnError ? 'PROCESSING ENGINE DISCONNECTED' : 'ENGINE CONFIGURATION ERROR'}
              </h4>
              <p className="text-xs text-cz-ink/80 leading-relaxed mb-4 max-w-xl">
                {error}
              </p>
              <button
                type="button"
                onClick={fetchProfiles}
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
            CONNECTING TO ENGINE DECK...
          </p>
          <p className="text-xs text-cz-ink/70 mt-1">Reading provider credentials</p>
        </div>
      ) : profiles.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 bg-cz-parchment border-2 border-cz-ink max-w-lg mx-auto p-8 relative shadow-[4px_4px_0px_#18140F]">
          <Cpu className="w-12 h-12 text-cz-rust mx-auto mb-4" />
          <h3 className="font-display text-3xl tracking-tight text-cz-ink uppercase mb-2">No Engines Configured</h3>
          <p className="text-xs sm:text-sm text-cz-ink/75 mb-6 leading-relaxed max-w-sm mx-auto">
            Add an AI provider profile (e.g. Ollama Cloud or Local) to run video retention analysis.
          </p>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper text-xs font-bold uppercase tracking-wider border-2 border-cz-ink shadow-[3px_3px_0px_#18140F] cursor-pointer"
          >
            Create engine profile
          </button>
        </div>
      ) : (
        /* Profiles Rendered as Pill-Tagged Rows with Thin Divider Rules */
        <div className="bg-cz-parchment border-2 border-cz-ink shadow-[4px_4px_0px_#18140F] divide-y-2 divide-cz-parchment-border">
          {profiles.map((p) => {
            const isActive = p.id === activeProfileId;

            return (
              <div
                key={p.id}
                className={`p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isActive ? 'bg-cz-paper/70' : 'hover:bg-cz-paper/40'
                }`}
              >
                {/* Left Side: Info with Pill Badges */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-base text-cz-ink">
                      {p.name}
                    </span>

                    {isActive && (
                      <PillBadge
                        icon={<CheckCircle2 className="w-3 h-3" />}
                        label="Active Default"
                        chipColor="moss"
                        active={true}
                        className="py-0.5 px-2.5 text-[10px]"
                      />
                    )}

                    <PillBadge
                      icon={<Cpu className="w-3 h-3" />}
                      label={p.provider_type}
                      chipColor="ink"
                      active={false}
                      className="py-0.5 px-2 text-[10px]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cz-ink/75">
                    <span>Model: <strong className="text-cz-ink font-bold">{p.model}</strong></span>
                    <span>&bull;</span>
                    <span className="truncate max-w-sm">Base URL: {p.base_url}</span>
                    {p.requires_api_key && (
                      <>
                        <span>&bull;</span>
                        <span className={p.has_api_key ? 'text-cz-moss font-bold' : 'text-cz-rust font-bold'}>
                          {p.has_api_key ? 'Key Configured' : 'Key Missing'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center space-x-2 shrink-0 border-t sm:border-t-0 border-cz-ink/20 pt-3 sm:pt-0">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => handleSetActive(p.id)}
                      className="px-3 py-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-ink text-cz-ink text-xs font-bold transition-colors cursor-pointer shadow-[1px_1px_0px_#18140F]"
                    >
                      Set default
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(p)}
                    className="p-1.5 bg-cz-paper hover:bg-cz-parchment border-2 border-cz-ink text-cz-ink hover:text-cz-rust transition-colors cursor-pointer shadow-[1px_1px_0px_#18140F]"
                    title="Edit Engine Parameters"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {profiles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteProfile(p.id)}
                      className="p-1.5 bg-cz-paper hover:bg-cz-rust hover:text-cz-paper border-2 border-cz-ink text-cz-ink transition-colors cursor-pointer shadow-[1px_1px_0px_#18140F]"
                      title="Remove Engine Profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog for Add/Edit Profile */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-cz-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cz-paper border-2 border-cz-ink max-w-lg w-full p-6 shadow-[6px_6px_0px_#18140F] relative">
            <div className="flex items-center justify-between mb-5 border-b-2 border-cz-ink pb-3">
              <h3 className="font-display text-2xl tracking-wide text-cz-ink uppercase">
                {modalMode === 'add' ? 'REGISTER AI ENGINE' : 'UPDATE AI ENGINE'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-cz-ink hover:text-cz-rust p-1 border border-transparent hover:border-cz-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 font-sans">
              <div>
                <label className="block text-[11px] font-bold text-cz-ink uppercase tracking-wider mb-1">
                  Engine Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(PROVIDER_DEFAULTS).map(([key, def]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTypeChange(key)}
                      className={`p-2 border-2 text-center text-xs font-bold transition-all cursor-pointer ${
                        formData.provider_type === key
                          ? 'bg-cz-rust text-cz-paper border-cz-ink shadow-[2px_2px_0px_#18140F]'
                          : 'bg-cz-parchment border-cz-ink/40 text-cz-ink hover:border-cz-ink'
                      }`}
                    >
                      {key === 'ollama_local' ? 'Local' : key === 'ollama_cloud' ? 'Ollama Cloud' : 'OpenAI Compat'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cz-ink uppercase tracking-wider mb-1">
                  Profile Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust font-sans"
                  placeholder="e.g. Ollama Cloud - gpt-oss:120b"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cz-ink uppercase tracking-wider mb-1">
                  Base API URL
                </label>
                <input
                  type="url"
                  required
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cz-ink uppercase tracking-wider mb-1">
                  Model Identifier
                </label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust font-sans"
                  placeholder="e.g. gpt-oss:120b or llama3.2"
                />
              </div>

              {currentMeta.needsKey && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-cz-ink uppercase tracking-wider">
                      Secret API Key
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="text-[11px] text-cz-ink/70 hover:text-cz-rust flex items-center space-x-1 cursor-pointer"
                    >
                      {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showKey ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    className="w-full bg-cz-parchment border-2 border-cz-ink px-3 py-2 text-xs text-cz-ink focus:outline-none focus:border-cz-rust font-sans"
                    placeholder={modalMode === 'edit' ? 'Leave blank to retain configured key' : 'Enter API Key...'}
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-4 border-t-2 border-cz-ink">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-cz-parchment hover:bg-cz-paper text-cz-ink border-2 border-cz-ink text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-cz-rust hover:bg-cz-rust-hover text-cz-paper font-bold text-xs uppercase tracking-wider border-2 border-cz-ink shadow-[2px_2px_0px_#18140F] cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save engine profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

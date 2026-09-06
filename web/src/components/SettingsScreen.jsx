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
} from 'lucide-react';

const PROVIDER_DEFAULTS = {
  ollama_local: {
    name: 'Ollama (Local)',
    desc: 'Run completely offline with zero API fees using local Ollama.',
    defaultUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    needsKey: false,
  },
  ollama_cloud: {
    name: 'Ollama (Cloud)',
    desc: 'High-speed cloud hosted models on ollama.com.',
    defaultUrl: 'https://ollama.com/v1',
    defaultModel: 'kimi-k2.6',
    needsKey: true,
  },
  openai_compat: {
    name: 'OpenAI-Compatible (Groq, OpenRouter, LM Studio, etc.)',
    desc: 'Connect to any OpenAI-compatible API endpoint with custom model and credentials.',
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
  const [successMsg, setSuccessMsg] = useState('');

  // Modal / Form state for Add/Edit Profile
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    provider_type: 'ollama_local',
    base_url: 'http://localhost:11434/v1',
    model: 'llama3.2',
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
    try {
      const res = await fetch('/settings/profiles');
      if (!res.ok) throw new Error(`Failed to load profiles: ${res.statusText}`);
      const data = await res.json();
      setProfiles(data.profiles || []);
      setActiveProfileId(data.active_profile || '');
    } catch (err) {
      setError(err.message || 'Error fetching profiles.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    const defaultType = 'openai_compat';
    const meta = PROVIDER_DEFAULTS[defaultType];
    setFormData({
      id: '',
      name: 'Groq - llama3.3-70b',
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
      const res = await fetch('/settings/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to save profile');
      }

      const updated = await res.json();
      setProfiles(updated.profiles || []);
      setActiveProfileId(updated.active_profile || '');
      setIsModalOpen(false);
      setSuccessMsg(modalMode === 'add' ? 'Profile added successfully!' : 'Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Error saving profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!window.confirm(`Are you sure you want to delete profile "${profileId}"?`)) return;

    setError('');
    try {
      const res = await fetch(`/settings/profiles/${encodeURIComponent(profileId)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to delete profile');
      }

      const updated = await res.json();
      setProfiles(updated.profiles || []);
      setActiveProfileId(updated.active_profile || '');
      setSuccessMsg('Profile deleted.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Error deleting profile.');
    }
  };

  const handleSetActive = async (profileId) => {
    try {
      const res = await fetch('/settings/active-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to set active profile');
      }

      const updated = await res.json();
      setProfiles(updated.profiles || []);
      setActiveProfileId(updated.active_profile || '');
      setSuccessMsg(`Default profile switched to "${profileId}"`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Error switching profile.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm">Loading AI Profiles...</p>
      </div>
    );
  }

  const currentMeta = PROVIDER_DEFAULTS[formData.provider_type] || PROVIDER_DEFAULTS.openai_compat;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">AI Provider Profiles</h2>
            <p className="text-xs text-slate-400">
              Manage named LLM profiles (Ollama, Groq, OpenRouter, Cloud) and choose which to use per job.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Profile</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {profiles.map((p) => {
          const isSelected = p.id === activeProfileId;
          const meta = PROVIDER_DEFAULTS[p.provider_type] || {};

          return (
            <div
              key={p.id}
              className={`rounded-2xl p-5 border transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900/90 border-emerald-500/40 shadow-xl shadow-emerald-500/5'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-bold text-base text-white">{p.name}</h3>
                      {isSelected && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                          <Star className="w-2.5 h-2.5 fill-emerald-400" />
                          <span>Default</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                      {p.provider_type}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(p)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Edit Profile"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {profiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProfile(p.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Delete Profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 py-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500 flex items-center space-x-1">
                      <Server className="w-3.5 h-3.5 text-slate-400" />
                      <span>Endpoint:</span>
                    </span>
                    <span className="font-mono text-slate-200 truncate max-w-[240px]" title={p.base_url}>
                      {p.base_url}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500 flex items-center space-x-1">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      <span>Model:</span>
                    </span>
                    <span className="font-mono text-emerald-400 font-medium">
                      {p.model}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-500 flex items-center space-x-1">
                      <Key className="w-3.5 h-3.5 text-slate-400" />
                      <span>Credentials:</span>
                    </span>
                    {p.requires_api_key ? (
                      p.has_api_key ? (
                        <span className="text-[11px] text-emerald-400 flex items-center space-x-1 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>API Key Configured in .env</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-400 flex items-center space-x-1 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          <span>Missing API Key</span>
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-slate-400">Local (No Key Needed)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center justify-between">
                {!isSelected ? (
                  <button
                    type="button"
                    onClick={() => handleSetActive(p.id)}
                    className="text-xs text-slate-400 hover:text-emerald-400 flex items-center space-x-1.5 transition-colors"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Set as Active Default</span>
                  </button>
                ) : (
                  <span className="text-xs text-emerald-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Profile for New Jobs</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for Add / Edit Profile */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">
                  {modalMode === 'add' ? 'Add Named AI Profile' : 'Edit AI Profile'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              {/* Profile Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Profile Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Groq - llama3.3-70b, Ollama Cloud - kimi-k2.6"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Provider Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Backend Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'ollama_local', label: 'Ollama Local' },
                    { id: 'ollama_cloud', label: 'Ollama Cloud' },
                    { id: 'openai_compat', label: 'OpenAI / Groq' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTypeChange(t.id)}
                      className={`py-2 px-2 text-xs font-medium rounded-lg border text-center transition-all ${
                        formData.provider_type === t.id
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Base URL (OpenAI-compatible)
                </label>
                <input
                  type="text"
                  required
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  placeholder={currentMeta.defaultUrl}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Model Identifier
                </label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder={currentMeta.defaultModel}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* API Key */}
              {currentMeta.needsKey && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    API Key (Saved to local .env)
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={formData.api_key}
                      onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                      placeholder={modalMode === 'edit' ? '•••••••• (Leave blank to keep existing)' : 'Enter API key...'}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Make Active Checkbox */}
              <div className="pt-2">
                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Set as default profile for new jobs</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{modalMode === 'add' ? 'Create Profile' : 'Save Changes'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

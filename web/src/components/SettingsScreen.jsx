import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle2, AlertCircle, Eye, EyeOff, Save, Loader2, Key, Server, Cpu } from 'lucide-react';

const PROVIDER_INFO = {
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
    defaultModel: 'deepseek-r1',
    needsKey: true,
  },
  openai_compat: {
    name: 'OpenAI-Compatible (Groq, OpenRouter, vLLM, LM Studio)',
    desc: 'Connect to any OpenAI-compatible API endpoint with custom model and credentials.',
    defaultUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true,
  },
};

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  const [activeProvider, setActiveProvider] = useState('ollama_local');
  const [providers, setProviders] = useState({
    ollama_local: { base_url: 'http://localhost:11434/v1', model: 'llama3.2', has_api_key: false },
    ollama_cloud: { base_url: 'https://ollama.com/v1', model: 'deepseek-r1', has_api_key: false },
    openai_compat: { base_url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', has_api_key: false },
  });

  // Local state for API keys input (only sent when user enters a new value)
  const [apiKeys, setApiKeys] = useState({
    ollama_cloud: '',
    openai_compat: '',
  });
  const [showKey, setShowKey] = useState({
    ollama_cloud: false,
    openai_compat: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/settings');
      if (!res.ok) throw new Error(`Failed to load settings: ${res.statusText}`);
      const data = await res.json();
      if (data.provider) setActiveProvider(data.provider);
      if (data.providers) setProviders((prev) => ({ ...prev, ...data.providers }));
    } catch (err) {
      setError(err.message || 'Error fetching settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (providerKey, field, value) => {
    setProviders((prev) => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        [field]: value,
      },
    }));
  };

  const handleApiKeyChange = (providerKey, value) => {
    setApiKeys((prev) => ({
      ...prev,
      [providerKey]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaveSuccess(false);

    try {
      const payload = {
        provider: activeProvider,
        providers: {},
      };

      for (const [pKey, pData] of Object.entries(providers)) {
        payload.providers[pKey] = {
          base_url: pData.base_url,
          model: pData.model,
        };
        if (apiKeys[pKey] && apiKeys[pKey].trim()) {
          payload.providers[pKey].api_key = apiKeys[pKey].trim();
        }
      }

      const res = await fetch('/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to save settings');
      }

      const updated = await res.json();
      if (updated.provider) setActiveProvider(updated.provider);
      if (updated.providers) setProviders((prev) => ({ ...prev, ...updated.providers }));
      // Clear key input fields after saving to .env
      setApiKeys({ ollama_cloud: '', openai_compat: '' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setError(err.message || 'Error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm">Loading LLM Configuration...</p>
      </div>
    );
  }

  const currentProviderData = providers[activeProvider] || {};
  const currentProviderMeta = PROVIDER_INFO[activeProvider] || {};

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">LLM Provider Settings</h2>
            <p className="text-xs text-slate-400">
              Configure the AI model backend that analyzes video transcripts to find viral clips.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Settings successfully updated and saved to config.yaml & .env!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Provider Selector Cards */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3">
            Active LLM Provider
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(PROVIDER_INFO).map(([key, info]) => {
              const isSelected = activeProvider === key;
              return (
                <div
                  key={key}
                  onClick={() => setActiveProvider(key)}
                  className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-bold ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                      {info.name}
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-400'
                          : 'border-slate-600'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{info.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Provider Configuration Form */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="font-semibold text-white text-base flex items-center space-x-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Configure {currentProviderMeta.name}</span>
            </h3>
            <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">
              {activeProvider}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Base URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                <span>Base URL</span>
              </label>
              <input
                type="text"
                value={currentProviderData.base_url || ''}
                onChange={(e) => handleProviderChange(activeProvider, 'base_url', e.target.value)}
                placeholder={currentProviderMeta.defaultUrl}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                OpenAI-compatible endpoint root (e.g. {currentProviderMeta.defaultUrl})
              </p>
            </div>

            {/* Model Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span>Model Name</span>
              </label>
              <input
                type="text"
                value={currentProviderData.model || ''}
                onChange={(e) => handleProviderChange(activeProvider, 'model', e.target.value)}
                placeholder={currentProviderMeta.defaultModel}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Model identifier passed to chat completions (e.g. {currentProviderMeta.defaultModel})
              </p>
            </div>
          </div>

          {/* API Key (if required by provider) */}
          {currentProviderMeta.needsKey ? (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>API Key</span>
                </span>
                {currentProviderData.has_api_key ? (
                  <span className="text-[11px] text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>API Key currently set in .env</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-400 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>No API Key configured</span>
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showKey[activeProvider] ? 'text' : 'password'}
                  value={apiKeys[activeProvider] || ''}
                  onChange={(e) => handleApiKeyChange(activeProvider, e.target.value)}
                  placeholder={
                    currentProviderData.has_api_key
                      ? '•••••••••••••••• (Leave blank to keep existing key)'
                      : 'Enter your API key here...'
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono pr-12"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowKey((prev) => ({ ...prev, [activeProvider]: !prev[activeProvider] }))
                  }
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showKey[activeProvider] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Keys are stored securely in your local <code className="text-slate-400">.env</code> file and never sent to third-party servers.
              </p>
            </div>
          ) : (
            <div className="pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ollama Local runs on your local machine and does not require an API key.</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

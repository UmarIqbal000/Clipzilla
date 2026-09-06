import React from 'react';
import { Sparkles, Settings, Video, Sliders, Clock, Film } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, hasClips, hasEditingClip }) {
  return (
    <header className="border-b border-cz-border bg-cz-surface/95 backdrop-blur-md sticky top-0 z-50">
      {/* Subtle top film sprocket strip */}
      <div className="h-1 w-full sprocket-track-h opacity-40 border-b border-cz-border/40" />

      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Lockup */}
        <div
          className="flex items-center space-x-2 sm:space-x-3.5 cursor-pointer group"
          onClick={() => setActiveTab('create')}
        >
          <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-md bg-cz-base border border-cz-border group-hover:border-cz-ember/60 flex items-center justify-center transition-colors relative overflow-hidden shadow-inner shrink-0">
            <span className="text-lg sm:text-2xl select-none group-hover:scale-110 transition-transform">🦖</span>
            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-cz-ember rounded-bl" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-display text-xl sm:text-2xl tracking-wider text-cz-bone uppercase leading-none">
                Clipzilla
              </span>
              <span className="hidden sm:inline-block text-[10px] font-semibold text-cz-ember border border-cz-ember/30 bg-cz-ember-subtle px-1.5 py-0.5 rounded leading-none">
                35MM
              </span>
            </div>
            <p className="text-[11px] text-cz-muted font-sans tracking-normal mt-0.5 hidden sm:block">
              Celluloid Video Devourer
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-0.5 sm:space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'create'
                ? 'bg-cz-raised text-cz-bone border border-cz-border shadow-sm relative after:absolute after:bottom-0 after:left-1.5 after:right-1.5 after:h-[2px] after:bg-cz-ember'
                : 'text-cz-muted hover:text-cz-bone hover:bg-cz-raised/50 border border-transparent'
            }`}
            title="Create"
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'create' ? 'text-cz-ember' : ''}`} />
            <span className="hidden md:inline">Create</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'results'
                ? 'bg-cz-raised text-cz-bone border border-cz-border shadow-sm relative after:absolute after:bottom-0 after:left-1.5 after:right-1.5 after:h-[2px] after:bg-cz-ember'
                : 'text-cz-muted hover:text-cz-bone hover:bg-cz-raised/50 border border-transparent'
            }`}
            title="Shorts"
          >
            <Video className={`w-3.5 h-3.5 ${activeTab === 'results' ? 'text-cz-ember' : ''}`} />
            <span className="hidden md:inline">Shorts</span>
            {hasClips && (
              <span className="w-1.5 h-1.5 rounded-full bg-cz-ember animate-ping" />
            )}
          </button>

          {hasEditingClip && (
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'editor'
                  ? 'bg-cz-raised text-cz-bone border border-cz-border shadow-sm relative after:absolute after:bottom-0 after:left-1.5 after:right-1.5 after:h-[2px] after:bg-cz-ember'
                  : 'text-cz-muted hover:text-cz-bone hover:bg-cz-raised/50 border border-transparent'
              }`}
              title="Editor"
            >
              <Sliders className={`w-3.5 h-3.5 ${activeTab === 'editor' ? 'text-cz-ember' : ''}`} />
              <span className="hidden md:inline">Editor</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-cz-raised text-cz-bone border border-cz-border shadow-sm relative after:absolute after:bottom-0 after:left-1.5 after:right-1.5 after:h-[2px] after:bg-cz-ember'
                : 'text-cz-muted hover:text-cz-bone hover:bg-cz-raised/50 border border-transparent'
            }`}
            title="History"
          >
            <Clock className={`w-3.5 h-3.5 ${activeTab === 'history' ? 'text-cz-ember' : ''}`} />
            <span className="hidden md:inline">History</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'settings'
                ? 'bg-cz-raised text-cz-bone border border-cz-border shadow-sm relative after:absolute after:bottom-0 after:left-1.5 after:right-1.5 after:h-[2px] after:bg-cz-ember'
                : 'text-cz-muted hover:text-cz-bone hover:bg-cz-raised/50 border border-transparent'
            }`}
            title="Settings"
          >
            <Settings className={`w-3.5 h-3.5 ${activeTab === 'settings' ? 'text-cz-ember' : ''}`} />
            <span className="hidden md:inline">Settings</span>
          </button>
        </nav>
      </div>
    </header>
  );
}


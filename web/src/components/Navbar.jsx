import React from 'react';
import { Sparkles, Settings, Video, Clock, Share2 } from 'lucide-react';

export default function Navbar({ currentPath = '/home', navigate, hasClips, hasAccounts }) {
  const isHome = currentPath === '/' || currentPath === '/home';
  const isShorts = currentPath === '/shorts';
  const isHistory = currentPath === '/history' || currentPath?.startsWith('/batch');
  const isAccounts = currentPath === '/accounts';
  const isSettings = currentPath === '/settings';

  return (
    <header className="border-b-2 border-cz-ink bg-cz-paper sticky top-0 z-50 select-none">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Lockup */}
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => navigate('/home')}
        >
          <div className="w-10 h-10 rounded-none bg-cz-paper border-2 border-cz-ink group-hover:bg-cz-parchment flex items-center justify-center transition-all shadow-[2px_2px_0px_#18140F] group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-[1px_1px_0px_#18140F] overflow-hidden shrink-0">
            <img src="/logo.png" alt="Clipzilla" className="w-full h-full object-cover select-none" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-display text-2xl sm:text-3xl tracking-wider text-cz-ink uppercase leading-none">
                Clipzilla
              </span>
              <span className="hidden sm:inline-block text-[10px] font-sans font-extrabold text-cz-rust border border-cz-rust px-1.5 py-0.2 rounded-none tracking-wider bg-cz-parchment uppercase">
                v1
              </span>
            </div>
            <p className="text-[11px] text-cz-ink/70 font-sans tracking-tight leading-none mt-0.5 hidden sm:block">
              Viral Shorts Devourer
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-1.5">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold font-sans transition-all cursor-pointer ${
              isHome
                ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                : 'text-cz-ink hover:bg-cz-parchment border-2 border-transparent hover:border-cz-ink'
            }`}
            title="Create"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Create</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/shorts')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold font-sans transition-all cursor-pointer relative ${
              isShorts
                ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                : 'text-cz-ink hover:bg-cz-parchment border-2 border-transparent hover:border-cz-ink'
            }`}
            title="Shorts"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Shorts</span>
            {hasClips && (
              <span className="w-2 h-2 rounded-full bg-cz-moss animate-ping ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/history')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold font-sans transition-all cursor-pointer ${
              isHistory
                ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                : 'text-cz-ink hover:bg-cz-parchment border-2 border-transparent hover:border-cz-ink'
            }`}
            title="History"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden md:inline">History</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/accounts')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold font-sans transition-all cursor-pointer ${
              isAccounts
                ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                : 'text-cz-ink hover:bg-cz-parchment border-2 border-transparent hover:border-cz-ink'
            }`}
            title="Accounts"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Accounts</span>
            {hasAccounts && (
              <span className="w-1.5 h-1.5 rounded-full bg-cz-moss ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold font-sans transition-all cursor-pointer ${
              isSettings
                ? 'bg-cz-rust text-cz-paper border-2 border-cz-ink shadow-[2px_2px_0px_#18140F]'
                : 'text-cz-ink hover:bg-cz-parchment border-2 border-transparent hover:border-cz-ink'
            }`}
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Settings</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

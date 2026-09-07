import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function TopAnnouncementStrip({
  tag = 'AI PIPELINE',
  message = 'Clipzilla Neural Engine v0.2 active: on-premise face tracking & transcription',
  ctaText = 'Configure Engine',
  onCtaClick,
}) {
  return (
    <aside aria-label="Announcement" className="bg-cz-ink text-cz-paper border-b border-cz-ink text-xs py-2 px-4 select-none relative z-40">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cz-rust text-cz-paper shrink-0">
            {tag}
          </span>
          <span className="truncate font-sans font-medium text-[11px] sm:text-xs text-cz-paper/90">
            {message}
          </span>
        </div>

        {ctaText && onCtaClick && (
          <button
            type="button"
            onClick={onCtaClick}
            className="inline-flex items-center space-x-1 font-bold text-[11px] text-cz-paper hover:text-cz-rust transition-colors underline underline-offset-4 decoration-cz-rust shrink-0 cursor-pointer"
          >
            <span>{ctaText}</span>
            <ArrowRight className="w-3 h-3 text-cz-rust" />
          </button>
        )}
      </div>
    </aside>
  );
}

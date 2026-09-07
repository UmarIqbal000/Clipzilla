import React from 'react';

const DEFAULT_ITEMS = [
  { text: 'Devour Long-Form Footage', accent: false },
  { text: 'Local-First Architecture', accent: true },
  { text: '100% Private On-Premise', accent: false },
  { text: 'Neural Speaker Tracking', accent: true },
  { text: 'Kinetic Karaoke Captions', accent: false },
  { text: 'Zero Cloud Surveillance', accent: true },
  { text: '9:16 Vertical Cuts', accent: false },
  { text: 'Open Source Celluloid', accent: true },
];

export default function MarqueeTicker({ items = DEFAULT_ITEMS, speedClass = '' }) {
  // Duplicate list to achieve continuous seamless loop
  const displayItems = [...items, ...items, ...items];

  return (
    <div className="bg-cz-ink text-cz-paper border-y-2 border-cz-ink overflow-hidden py-2 select-none relative z-20">
      <div className={`animate-marquee-track flex items-center space-x-6 whitespace-nowrap ${speedClass}`}>
        {displayItems.map((item, idx) => (
          <React.Fragment key={idx}>
            <span
              className={`font-display text-base sm:text-lg tracking-wider uppercase ${
                item.accent ? 'text-cz-rust' : 'text-cz-paper'
              }`}
            >
              {item.text}
            </span>
            <span className="text-cz-rust/80 text-xs select-none">◆</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

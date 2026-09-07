import React from 'react';

/**
 * StatBlockRow
 * Renders oversized condensed numbers with short uppercase labels and thin divider rules.
 * Automatically wraps into a 2x2 grid on mobile and a single row on tablet/desktop.
 *
 * @param {Array<{ label: string, value: string|number, hint?: string }>} stats
 */
export default function StatBlockRow({ stats = [] }) {
  if (!stats || stats.length === 0) return null;

  return (
    <div className="bg-cz-parchment border-2 border-cz-ink my-6">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-cz-parchment-border">
        {stats.map((item, idx) => (
          <div
            key={idx}
            className={`p-4 sm:p-5 flex flex-col justify-center ${
              // Add divider rule for 2x2 mobile layout if needed
              idx % 2 === 0 ? 'border-r md:border-r-0 border-cz-parchment-border' : ''
            }`}
          >
            <span className="font-display text-4xl sm:text-5xl lg:text-6xl text-cz-ink leading-none tracking-tight tabular-nums">
              {item.value}
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-cz-ink/70 font-sans tracking-wider uppercase mt-1.5 line-clamp-1">
              {item.label}
            </span>
            {item.hint && (
              <span className="text-[10px] text-cz-muted font-sans mt-0.5">
                {item.hint}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

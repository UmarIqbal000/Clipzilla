import React from 'react';

export default function PillBadge({
  icon: Icon,
  label,
  sublabel,
  chipColor = 'rust',
  active = false,
  onClick,
  className = '',
}) {
  const chipBgClasses = {
    rust: 'bg-cz-rust text-cz-paper',
    moss: 'bg-cz-moss text-cz-paper',
    ink: 'bg-cz-ink text-cz-paper',
    parchment: 'bg-cz-parchment-border text-cz-ink',
  };

  const Component = onClick ? 'button' : 'div';

  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    const IconComp = Icon;
    return <IconComp className="w-3 h-3" />;
  };

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center space-x-2 rounded-full px-3 py-1.5 transition-all text-xs font-sans select-none border ${
        active
          ? 'bg-cz-rust text-cz-paper border-cz-ink shadow-[2px_2px_0px_#18140F]'
          : 'bg-cz-parchment/90 text-cz-ink border-cz-ink/30 hover:border-cz-ink hover:bg-cz-parchment'
      } ${onClick ? 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]' : ''} ${className}`}
    >
      {Icon && (
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
            active ? 'bg-cz-paper text-cz-rust' : chipBgClasses[chipColor] || chipBgClasses.rust
          }`}
        >
          {renderIcon()}
        </span>
      )}
      <span className="font-bold tracking-tight">{label}</span>
      {sublabel && (
        <span
          className={`text-[10px] uppercase tracking-wider font-semibold pl-1 border-l ${
            active ? 'text-cz-paper/80 border-cz-paper/40' : 'text-cz-muted border-cz-ink/20'
          }`}
        >
          {sublabel}
        </span>
      )}
    </Component>
  );
}

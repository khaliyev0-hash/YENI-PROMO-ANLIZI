import React, { useRef, useState, useCallback } from 'react';

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan';
  variant?: 'glass' | 'solid' | 'subtle';
  interactive?: boolean;
  glowBorder?: boolean | 'blue' | 'amber' | 'cyan' | 'emerald' | 'rose';
}

const colorMap = {
  blue: {
    spotlight: 'rgba(59, 130, 246, 0.16)',
    borderGlow: 'rgba(59, 130, 246, 0.4)',
    accentBorder: 'hover:border-blue-500/50 dark:hover:border-blue-400/50',
    topLine: 'from-blue-500/80 via-cyan-400/80 to-blue-600/80',
  },
  emerald: {
    spotlight: 'rgba(16, 185, 129, 0.16)',
    borderGlow: 'rgba(16, 185, 129, 0.4)',
    accentBorder: 'hover:border-emerald-500/50 dark:hover:border-emerald-400/50',
    topLine: 'from-emerald-400/80 via-teal-300/80 to-emerald-600/80',
  },
  amber: {
    spotlight: 'rgba(245, 158, 11, 0.18)',
    borderGlow: 'rgba(245, 158, 11, 0.45)',
    accentBorder: 'hover:border-amber-500/50 dark:hover:border-amber-400/50',
    topLine: 'from-amber-400/80 via-yellow-300/80 to-amber-600/80',
  },
  rose: {
    spotlight: 'rgba(244, 63, 94, 0.16)',
    borderGlow: 'rgba(244, 63, 94, 0.4)',
    accentBorder: 'hover:border-rose-500/50 dark:hover:border-rose-400/50',
    topLine: 'from-rose-500/80 via-pink-400/80 to-rose-600/80',
  },
  purple: {
    spotlight: 'rgba(168, 85, 247, 0.16)',
    borderGlow: 'rgba(168, 85, 247, 0.4)',
    accentBorder: 'hover:border-purple-500/50 dark:hover:border-purple-400/50',
    topLine: 'from-purple-500/80 via-fuchsia-400/80 to-purple-600/80',
  },
  cyan: {
    spotlight: 'rgba(6, 182, 212, 0.16)',
    borderGlow: 'rgba(6, 182, 212, 0.4)',
    accentBorder: 'hover:border-cyan-500/50 dark:hover:border-cyan-400/50',
    topLine: 'from-cyan-400/80 via-blue-400/80 to-cyan-600/80',
  },
};

/**
 * SpotlightCard:
 * High-tech glassmorphic card component with reactive 3D cursor-tracking neon spotlight,
 * subtle illuminated top accent bar, and ambient hover elevation.
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  spotlightColor = 'blue',
  variant = 'glass',
  interactive = true,
  glowBorder = false,
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState<number>(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !interactive) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, [interactive]);

  const handleMouseEnter = useCallback(() => {
    if (interactive) setOpacity(1);
  }, [interactive]);

  const handleMouseLeave = useCallback(() => {
    if (interactive) setOpacity(0);
  }, [interactive]);

  const colorCfg = colorMap[spotlightColor] || colorMap.blue;

  // Luminous border class map
  const effectiveGlowColor = typeof glowBorder === 'string'
    ? glowBorder
    : glowBorder === true
    ? spotlightColor
    : null;

  const luminousClass = effectiveGlowColor
    ? effectiveGlowColor === 'amber'
      ? 'luminous-border-amber'
      : effectiveGlowColor === 'cyan'
      ? 'luminous-border-cyan'
      : effectiveGlowColor === 'emerald'
      ? 'luminous-border-emerald'
      : 'luminous-border-blue'
    : '';

  // Base background variants
  const baseBg = variant === 'glass'
    ? 'bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-slate-200/90 dark:border-slate-800/90 shadow-md shadow-slate-200/40 dark:shadow-none'
    : variant === 'subtle'
    ? 'bg-slate-50/90 dark:bg-slate-900/60 backdrop-blur-xs border-slate-200/70 dark:border-slate-800/70 shadow-xs'
    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm';

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 group ${baseBg} ${luminousClass || colorCfg.accentBorder} ${
        interactive ? 'hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]' : ''
      } ${className}`}
      {...rest}
    >
      {/* Top subtle illuminated gradient accent line (permanent delicate glow, lights up on hover) */}
      <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${colorCfg.topLine} opacity-40 group-hover:opacity-100 transition-opacity duration-300 z-10 shadow-xs`} />

      {/* Reactive Cursor-Tracking Neon Spotlight Layer */}
      {interactive && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
          style={{
            opacity,
            background: `radial-gradient(320px circle at ${position.x}px ${position.y}px, ${colorCfg.spotlight}, transparent 80%)`,
          }}
        />
      )}

      {/* Card Content with relative z-index */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
};

export default SpotlightCard;

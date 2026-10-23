import React from 'react';

export type GlowingBadgeVariant = 'optimal' | 'critical' | 'warning' | 'info' | 'purple' | 'slate';

interface GlowingBadgeProps {
  variant?: GlowingBadgeVariant;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  pulse?: boolean;
  className?: string;
  title?: string;
}

const VARIANT_MAP: Record<GlowingBadgeVariant, {
  bg: string;
  border: string;
  text: string;
  dot: string;
  glow: string;
}> = {
  optimal: {
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/60',
    border: 'border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    glow: 'shadow-emerald-500/20'
  },
  critical: {
    bg: 'bg-rose-50/80 dark:bg-rose-950/60',
    border: 'border-rose-300 dark:border-rose-800',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    glow: 'shadow-rose-500/20'
  },
  warning: {
    bg: 'bg-amber-50/80 dark:bg-amber-950/60',
    border: 'border-amber-300 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
    glow: 'shadow-amber-500/20'
  },
  info: {
    bg: 'bg-blue-50/80 dark:bg-blue-950/60',
    border: 'border-blue-300 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    glow: 'shadow-blue-500/20'
  },
  purple: {
    bg: 'bg-purple-50/80 dark:bg-purple-950/60',
    border: 'border-purple-300 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
    glow: 'shadow-purple-500/20'
  },
  slate: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-300 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-400',
    glow: 'shadow-slate-500/10'
  }
};

export const GlowingBadge: React.FC<GlowingBadgeProps> = ({
  variant = 'info',
  label,
  sublabel,
  icon,
  pulse = true,
  className = '',
  title
}) => {
  const styles = VARIANT_MAP[variant] || VARIANT_MAP.info;

  return (
    <span
      title={title || label}
      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold border backdrop-blur-xs shadow-xs transition-all ${styles.bg} ${styles.border} ${styles.text} ${styles.glow} ${className}`}
    >
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${styles.dot}`}
              style={{ animationDuration: '2s' }}
            />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${styles.dot}`} />
        </span>
      )}
      <span className="truncate">{label}</span>
      {sublabel && (
        <span className="text-[9px] opacity-75 font-mono ml-0.5">({sublabel})</span>
      )}
    </span>
  );
};

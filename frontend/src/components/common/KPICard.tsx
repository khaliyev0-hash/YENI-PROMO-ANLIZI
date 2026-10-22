import React, { useRef, useState, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';

interface KPICardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple' | 'slate';
  variant?: 'solid' | 'soft';
  trend?: string;
  index?: number;
  delayMs?: number;
  luminousBorder?: 'blue' | 'amber' | 'cyan' | 'emerald' | 'rose' | boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  color = 'blue',
  variant = 'solid',
  trend,
  index = 0,
  delayMs,
  luminousBorder = true
}) => {
  const animatedValue = useCountUp(value, 900);
  const calculatedDelay = delayMs !== undefined ? delayMs : index * 70;

  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  // Icon container gradient & neon glow maps (Solid vs Soft variant)
  const iconBgMap = {
    solid: {
      blue: 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/35 ring-2 ring-blue-400/30',
      emerald: 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/35 ring-2 ring-emerald-400/30',
      amber: 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/35 ring-2 ring-amber-400/30',
      rose: 'bg-gradient-to-br from-rose-400 via-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/35 ring-2 ring-rose-400/30',
      indigo: 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/35 ring-2 ring-indigo-400/30',
      purple: 'bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/35 ring-2 ring-purple-400/30',
      slate: 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white shadow-lg shadow-slate-500/35 ring-2 ring-slate-400/30',
    },
    soft: {
      blue: 'bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200/90 text-blue-600 border border-blue-300/80 shadow-md shadow-blue-500/20 ring-2 ring-blue-400/25',
      emerald: 'bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200/90 text-emerald-700 border border-emerald-300/80 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-400/25',
      amber: 'bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 text-amber-800 border border-amber-300/80 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/25',
      rose: 'bg-gradient-to-br from-rose-50 via-rose-100 to-rose-200/90 text-rose-700 border border-rose-300/80 shadow-md shadow-rose-500/20 ring-2 ring-rose-400/25',
      indigo: 'bg-gradient-to-br from-indigo-50 via-indigo-100 to-indigo-200/90 text-indigo-700 border border-indigo-300/80 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-400/25',
      purple: 'bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200/90 text-purple-700 border border-purple-300/80 shadow-md shadow-purple-500/20 ring-2 ring-purple-400/25',
      slate: 'bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300/80 text-slate-700 border border-slate-300 shadow-md shadow-slate-400/20 ring-2 ring-slate-300/30',
    }
  };

  const pingBgMap = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    indigo: 'bg-indigo-500',
    purple: 'bg-purple-500',
    slate: 'bg-slate-400',
  };

  const cardGlowMap = {
    blue: 'card-accent-blue',
    emerald: 'card-accent-emerald',
    amber: 'card-accent-amber',
    rose: 'card-accent-rose',
    indigo: 'card-accent-blue',
    purple: 'card-accent-purple',
    slate: 'card-accent-blue',
  };

  const spotlightColorMap = {
    blue: 'rgba(59, 130, 246, 0.16)',
    emerald: 'rgba(16, 185, 129, 0.16)',
    amber: 'rgba(245, 158, 11, 0.18)',
    rose: 'rgba(244, 63, 94, 0.16)',
    indigo: 'rgba(99, 102, 241, 0.16)',
    purple: 'rgba(168, 85, 247, 0.16)',
    slate: 'rgba(148, 163, 184, 0.14)',
  };

  const topLineMap = {
    blue: 'from-blue-500 via-cyan-400 to-blue-600',
    emerald: 'from-emerald-400 via-teal-300 to-emerald-600',
    amber: 'from-amber-400 via-yellow-300 to-amber-600',
    rose: 'from-rose-500 via-pink-400 to-rose-600',
    indigo: 'from-indigo-500 via-purple-400 to-indigo-600',
    purple: 'from-purple-500 via-fuchsia-400 to-purple-600',
    slate: 'from-slate-400 via-slate-300 to-slate-500',
  };

  const selectedIconStyle = iconBgMap[variant][color] || iconBgMap.solid.blue;

  // Luminous delicate border line styling
  const effectiveLuminous = luminousBorder === true ? color : luminousBorder;
  const luminousBorderClass = effectiveLuminous === 'amber'
    ? 'luminous-border-amber'
    : effectiveLuminous === 'blue' || effectiveLuminous === 'indigo'
    ? 'luminous-border-blue'
    : effectiveLuminous === 'emerald'
    ? 'luminous-border-emerald'
    : effectiveLuminous === 'rose'
    ? 'border-rose-300/80 dark:border-rose-900/60 shadow-[0_0_12px_rgba(244,63,94,0.18)]'
    : effectiveLuminous === 'cyan'
    ? 'luminous-border-cyan'
    : '';

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative p-4 rounded-2xl bg-white/85 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 shadow-md shadow-slate-200/50 dark:shadow-none ${luminousBorderClass || cardGlowMap[color]} card-hover animate-card-stagger flex flex-col justify-between space-y-3 transition-all duration-300 group/card overflow-hidden`}
      style={{ animationDelay: `${calculatedDelay}ms` }}
    >
      {/* Top delicate illuminated gradient line (permanent soft luminescence, lights up on hover) */}
      <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${topLineMap[color]} opacity-50 group-hover/card:opacity-100 transition-opacity duration-300 z-10 shadow-xs`} />

      {/* Reactive 3D Cursor-Tracking Neon Spotlight Layer */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(280px circle at ${position.x}px ${position.y}px, ${spotlightColorMap[color]}, transparent 75%)`,
        }}
      />

      {/* Success Sparkle Burst Particles (One-Time 0.6s Animation) */}
      {(color === 'emerald' || (trend && trend.includes('Nailiyyət'))) && (
        <div className="absolute top-4 right-4 pointer-events-none z-10">
          <span className="absolute w-2 h-2 rounded-full bg-amber-400 shadow-md animate-[sparkleBurst1_0.6s_ease-out_forwards]" />
          <span className="absolute w-1.5 h-1.5 rounded-full bg-amber-300 shadow-md animate-[sparkleBurst2_0.6s_ease-out_forwards]" />
          <span className="absolute w-2 h-2 rounded-full bg-amber-400 shadow-md animate-[sparkleBurst3_0.6s_ease-out_forwards]" />
          <span className="absolute w-1.5 h-1.5 rounded-full bg-amber-300 shadow-md animate-[sparkleBurst4_0.6s_ease-out_forwards]" />
          <span className="absolute w-2 h-2 rounded-full bg-amber-400 shadow-md animate-[sparkleBurst5_0.6s_ease-out_forwards]" />
          <span className="absolute w-1.5 h-1.5 rounded-full bg-amber-300 shadow-md animate-[sparkleBurst6_0.6s_ease-out_forwards]" />
        </div>
      )}
      <div className="flex items-center justify-between relative z-10">
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tracking-wider uppercase">{title}</span>
        
        {/* Animated & Illuminated Glowing Icon Container */}
        <div className="relative group/icon">
          {/* Animated Pulsing Ring */}
          <span
            className={`absolute inset-0 rounded-xl animate-ping opacity-25 ${pingBgMap[color]}`}
            style={{ animationDuration: '3.5s' }}
          />

          {/* Glowing Animated Icon Box */}
          <div className={`relative p-2.5 rounded-xl transition-all duration-300 group-hover/card:scale-115 group-hover/card:rotate-3 ${selectedIconStyle}`}>
            <Icon
              className="w-4 h-4 stroke-[2.2] animate-pulse transition-transform duration-300 group-hover/icon:scale-125"
              style={{ animationDuration: '2.5s' }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between pt-1 relative z-10">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans tabular-nums">{animatedValue}</h3>
        {trend && (
          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300 shadow-xs flex items-center gap-1 neon-pulse-emerald">
            {trend}
          </span>
        )}
      </div>

      {subtext && (
        <div className="pt-1 border-t border-slate-100/80 dark:border-slate-800 flex items-center justify-between relative z-10">
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-400">{subtext}</p>
        </div>
      )}
    </div>
  );
};

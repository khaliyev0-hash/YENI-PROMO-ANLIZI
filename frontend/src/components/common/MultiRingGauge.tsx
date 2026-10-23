import React, { useMemo } from 'react';
import { Sparkles, TrendingUp, ShieldCheck, Zap } from 'lucide-react';

interface RingItem {
  label: string;
  value: number; // 0 - 100+
  target?: number;
  color: string;
  trackColor: string;
  icon?: React.ReactNode;
  unit?: string;
}

interface MultiRingGaugeProps {
  title?: string;
  subtitle?: string;
  rings: RingItem[];
  centerValue?: string | number;
  centerLabel?: string;
  size?: number;
  className?: string;
}

export const MultiRingGauge: React.FC<MultiRingGaugeProps> = ({
  title = "Makro Hədəf və İcra İndeksi",
  subtitle = "Satış, Qaçış Sürəti və Stok Sağlamlığının Sinxron Reallaşması",
  rings,
  centerValue,
  centerLabel = "Reallaşma",
  size = 180,
  className = ""
}) => {
  const center = size / 2;
  const strokeWidth = Math.max(6, Math.round(size * 0.04));
  const ringGap = Math.max(3, Math.round(size * 0.02));

  // Compute ring geometries
  const ringMetrics = useMemo(() => {
    return rings.map((ring, idx) => {
      const radius = center - strokeWidth - idx * (strokeWidth + ringGap) - 8;
      const circumference = 2 * Math.PI * radius;
      const clampVal = Math.max(0, ring.value);
      const strokeDashoffset = circumference - (Math.min(clampVal, 100) / 100) * circumference;
      
      return {
        ...ring,
        radius,
        circumference,
        strokeDashoffset,
        isOver100: clampVal > 100
      };
    });
  }, [rings, center, strokeWidth, ringGap]);

  const primaryValue = centerValue !== undefined 
    ? centerValue 
    : (rings[0] ? `${Math.round(rings[0].value)}%` : '0%');

  return (
    <div className={`p-4 sm:p-5 rounded-2xl glass-card relative overflow-hidden flex flex-col justify-between ${className}`}>
      {/* Background ambient lighting */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-amber-500/10 dark:bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div>
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="p-1 rounded-md bg-blue-600 text-white shadow-xs">
              <Zap className="w-3.5 h-3.5" />
            </span>
            {title}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          CANLI İNDEKSLƏR
        </span>
      </div>

      {/* Main Gauge Body */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 my-2 relative z-10">
        {/* Concentric Rings Visual */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90 drop-shadow-sm">
            {ringMetrics.map((ring, idx) => (
              <g key={idx}>
                {/* Background Track */}
                <circle
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  fill="none"
                  stroke={ring.trackColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  opacity={0.8}
                />
                {/* Active Colored Arc */}
                <circle
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={ring.circumference}
                  strokeDashoffset={ring.strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </g>
            ))}
          </svg>

          {/* Central Percentage Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 mb-0.5 animate-pulse" />
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none drop-shadow-xs">
              {primaryValue}
            </span>
            <span className="text-[9.5px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
              {centerLabel}
            </span>
          </div>
        </div>

        {/* Legend Stack */}
        <div className="flex-1 w-full sm:w-auto space-y-2">
          {ringMetrics.map((ring, idx) => {
            const pct = Math.round(ring.value * 10) / 10;
            return (
              <div 
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all card-lift"
              >
                <div className="flex items-center space-x-2">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                    style={{ backgroundColor: ring.color }} 
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {ring.label}
                  </span>
                </div>
                <div className="flex items-center space-x-1 font-mono font-bold text-xs">
                  <span className="text-slate-900 dark:text-white">
                    {pct}{ring.unit || '%'}
                  </span>
                  {ring.isOver100 && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                      AŞIR
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

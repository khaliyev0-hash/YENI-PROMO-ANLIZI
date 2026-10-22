import React from 'react';
import { Sparkles } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
  let dotClass = "bg-slate-400";
  let label = status;
  let showSparkle = false;

  switch (status.toUpperCase()) {
    case 'STOCKOUT_LIMITED':
      badgeClass = "bg-rose-50 text-rose-800 border-rose-300 font-extrabold shadow-xs shadow-rose-500/10";
      dotClass = "bg-rose-500 animate-pulse";
      label = "Stokout Məhdudiyyətli";
      break;
    case 'CRITICAL':
    case 'STOCKOUT':
      badgeClass = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
      dotClass = "bg-rose-500 animate-pulse";
      label = "Kritik / Stokout";
      break;
    case 'BELOW_TARGET':
    case 'UNDER_FORECAST':
    case 'WEAK':
      badgeClass = "bg-amber-50 text-amber-900 border-amber-300 font-bold";
      dotClass = "bg-amber-500";
      label = "Hədəfdən Aşağı";
      break;
    case 'HEALTHY':
    case 'GOOD':
      badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold";
      dotClass = "bg-emerald-500";
      label = "Sağlam";
      break;
    case 'OVER_PERFORMING':
    case 'EXCELLENT':
      badgeClass = "bg-blue-50 text-blue-900 border-blue-300 font-extrabold shadow-xs shadow-blue-500/10";
      dotClass = "bg-blue-500";
      label = "Yüksək Performans";
      showSparkle = true;
      break;
    case 'EXCESS':
    case 'HIGH_STOCK':
      badgeClass = "bg-purple-50 text-purple-900 border-purple-300 font-bold";
      dotClass = "bg-purple-500";
      label = "Artıq Stok Riski";
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] border tracking-wide uppercase ${badgeClass}`}>
      {showSparkle ? (
        <Sparkles className="w-3 h-3 text-amber-400 fill-amber-300 mr-1 shrink-0 animate-pulse" />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotClass}`} />
      )}
      {label}
    </span>
  );
};

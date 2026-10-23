import React from 'react';
import { Search, RefreshCw, FilterX, Layers, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: 'search' | 'filter' | 'data' | 'promo';
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "Məlumat Tapılmadı",
  description = "Axtarış və ya tətbiq olunmuş filtrlərə uyğun heç bir nəticə aşkar edilmədi. Zəhmət olmasa parametrləri dəqiqləşdirin.",
  icon = 'search',
  actionLabel,
  onAction,
  className = ""
}) => {
  return (
    <div className={`p-8 sm:p-12 rounded-3xl glass-card flex flex-col items-center justify-center text-center relative overflow-hidden my-4 ${className}`}>
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-amber-500/10 dark:bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Floating Geometric Illustration SVG */}
      <div className="relative mb-5 flex items-center justify-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-500/15 via-indigo-500/10 to-amber-500/15 border border-blue-400/30 flex items-center justify-center shadow-xl shadow-blue-500/10 relative z-10 animate-pulse" style={{ animationDuration: '3s' }}>
          {icon === 'search' && <Search className="w-9 h-9 text-blue-600 dark:text-blue-400 stroke-[1.8]" />}
          {icon === 'filter' && <FilterX className="w-9 h-9 text-amber-600 dark:text-amber-400 stroke-[1.8]" />}
          {icon === 'data' && <Layers className="w-9 h-9 text-indigo-600 dark:text-indigo-400 stroke-[1.8]" />}
          {icon === 'promo' && <Sparkles className="w-9 h-9 text-purple-600 dark:text-purple-400 stroke-[1.8]" />}
        </div>

        {/* Orbiting Mini Elements */}
        <div className="absolute -top-2 -right-3 p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md shadow-blue-500/15 z-20 animate-bounce" style={{ animationDuration: '2.4s' }}>
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="absolute -bottom-1 -left-3 p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md shadow-indigo-500/15 z-20 animate-bounce" style={{ animationDuration: '2.8s' }}>
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
        </div>
      </div>

      {/* Content */}
      <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight mb-1.5 relative z-10">
        {title}
      </h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed relative z-10 mb-4">
        {description}
      </p>

      {/* Action Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="relative z-10 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 active:scale-95 transition-all inline-flex items-center space-x-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};

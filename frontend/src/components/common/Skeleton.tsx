import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative overflow-hidden bg-slate-200/90 dark:bg-slate-800 rounded-xl ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 dark:via-slate-700/50 to-transparent" />
    </div>
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="w-24 h-4 rounded-md" />
        <Skeleton className="w-8 h-8 rounded-xl" />
      </div>
      <Skeleton className="w-32 h-7 rounded-lg" />
      <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
        <Skeleton className="w-20 h-3 rounded-md" />
        <Skeleton className="w-12 h-4 rounded-full" />
      </div>
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Table Header Skeleton */}
      <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="h-4 flex-1 rounded-md" />
        ))}
      </div>
      {/* Table Rows Skeleton */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-3">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-3 py-2.5 flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-1/4 rounded-md" />
            <Skeleton className="h-4 w-1/6 rounded-md" />
            <Skeleton className="h-4 w-1/6 rounded-md" />
            <Skeleton className="h-4 w-1/8 rounded-md" />
            <Skeleton className="h-4 w-1/8 rounded-md" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
};

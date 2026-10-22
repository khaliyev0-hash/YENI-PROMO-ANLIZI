import React from 'react';

interface HeaderAnimatedLinesProps {
  className?: string;
  subtle?: boolean;
}

export const HeaderAnimatedLines: React.FC<HeaderAnimatedLinesProps> = ({ className = '', subtle = false }) => {
  // TamStore Gold Sparkle 4-point star SVG path definition
  const SparkleStar = ({ size = 24, className = "", style = {} }: { size?: number; className?: string; style?: React.CSSProperties }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 12 0 C 12 6.627, 17.373 12, 24 12 C 17.373 12, 12 17.373, 12 24 C 12 17.373, 6.627 12, 0 12 C 6.627 12, 12 6.627, 12 0 Z"
        fill="url(#sparkleGoldGrad)"
        filter="url(#sparkleGlow)"
      />
    </svg>
  );

  const containerClasses = subtle
    ? `flex items-center justify-between py-1 px-6 bg-gradient-to-r from-blue-50/50 via-amber-50/40 to-blue-50/50 dark:from-blue-950/30 dark:via-amber-950/20 dark:to-blue-950/30 overflow-hidden relative h-full w-full opacity-95 ${className}`
    : `flex-1 mx-4 hidden md:flex items-center justify-between py-1 px-6 rounded-2xl bg-gradient-to-r from-blue-50/80 via-amber-50/60 to-blue-50/80 dark:from-blue-950/40 dark:via-amber-950/30 dark:to-blue-950/40 border border-slate-200/80 dark:border-slate-800 shadow-inner overflow-hidden relative h-10 w-full group ${className}`;

  return (
    <div className={containerClasses}>
      {/* Background Ambient Pulsing Glow Line */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 via-amber-400/30 to-blue-500/15 animate-pulse pointer-events-none" />

      {/* Embedded SVG Defs for Gradients and Neon Glows */}
      <svg className="absolute w-0 h-0" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sparkleGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          <filter id="sparkleGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="blueLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1479e8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#1479e8" stopOpacity="1.0" />
            <stop offset="100%" stopColor="#1479e8" stopOpacity="0.3" />
          </linearGradient>
        </defs>
      </svg>

      {/* Dynamic Background Blue Data Stream Line */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-90"
        viewBox="0 0 800 40"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M 0 20 C 100 5, 200 35, 300 20 C 400 5, 500 35, 600 20 C 700 5, 750 35, 800 20"
          stroke="url(#blueLineGrad)"
          strokeWidth="2.5"
          strokeDasharray="9 6"
          style={{ animation: 'sparkleDash 10s linear infinite' }}
        />
      </svg>

      {/* Floating & Twinkling TamStore Golden Sparkle Cluster Across Header */}
      <div className="flex items-center justify-between w-full z-10 px-4">
        {/* Cluster 1 (Left) */}
        <div className="flex items-center space-x-2 animate-pulse" style={{ animationDuration: '2.2s' }}>
          <SparkleStar size={16} className="animate-spin" style={{ animationDuration: '8s' }} />
          <SparkleStar size={22} className="transform hover:scale-125 transition-transform" />
          <SparkleStar size={12} className="animate-bounce" style={{ animationDuration: '1.4s' }} />
        </div>

        {/* Cluster 2 (Center Left) */}
        <div className="flex items-center space-x-3">
          <SparkleStar size={14} className="animate-pulse" style={{ animationDuration: '1.8s' }} />
          <div className="flex items-baseline space-x-1">
            <SparkleStar size={24} className="drop-shadow-md animate-bounce" style={{ animationDuration: '2.5s' }} />
            <SparkleStar size={10} className="animate-ping" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {/* Cluster 3 (Center) - Big TamStore Sparkle Trio matching user's exact uploaded image */}
        <div className="relative flex items-center justify-center py-1 px-3 bg-white/80 dark:bg-slate-900/80 rounded-full border border-amber-300/60 dark:border-amber-500/40 shadow-xs backdrop-blur-xs">
          <SparkleStar size={26} className="drop-shadow-lg transform hover:rotate-45 transition-transform duration-300" />
          <SparkleStar size={14} className="absolute -top-1 -right-1 animate-pulse" style={{ animationDuration: '1.2s' }} />
          <SparkleStar size={10} className="absolute -bottom-0.5 -left-1 animate-ping" style={{ animationDuration: '2s' }} />
        </div>

        {/* Cluster 4 (Center Right) */}
        <div className="flex items-center space-x-2">
          <SparkleStar size={12} className="animate-bounce" style={{ animationDuration: '1.6s' }} />
          <SparkleStar size={20} className="animate-pulse" style={{ animationDuration: '2.8s' }} />
          <SparkleStar size={15} />
        </div>

        {/* Cluster 5 (Right) */}
        <div className="flex items-center space-x-2 animate-pulse" style={{ animationDuration: '2.4s' }}>
          <SparkleStar size={10} className="animate-ping" style={{ animationDuration: '2.2s' }} />
          <SparkleStar size={22} className="animate-bounce" style={{ animationDuration: '2s' }} />
          <SparkleStar size={14} className="animate-spin" style={{ animationDuration: '10s' }} />
        </div>
      </div>

      {/* Embedded Animation Keyframes */}
      <style>{`
        @keyframes sparkleDash {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -200; }
        }
      `}</style>
    </div>
  );
};

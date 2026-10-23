import React, { useId } from 'react';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  color?: 'emerald' | 'rose' | 'blue' | 'amber' | 'indigo' | 'purple' | 'cyan' | 'auto';
  showFill?: boolean;
  showEndDot?: boolean;
  showBadge?: boolean;
  className?: string;
}

/**
 * Deterministically generates a realistic 10-14 point series for items
 * that only have total/achievement data, ensuring consistency across re-renders.
 */
export function generateDeterministicSparkline(
  seedKey: string | number,
  baseValue: number,
  trendPct: number = 0,
  points: number = 10
): number[] {
  const str = String(seedKey);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const result: number[] = [];
  const startVal = Math.max(1, baseValue * 0.7);
  const trendMultiplier = 1 + trendPct / 100;
  const targetEnd = startVal * trendMultiplier;

  for (let i = 0; i < points; i++) {
    const t = i / Math.max(1, points - 1);
    // Linear trajectory
    const linear = startVal + (targetEnd - startVal) * t;
    // Deterministic pseudo-random variation using hash
    const pseudoRand = Math.sin(hash + i * 1.7) * 0.15;
    const val = Math.max(0, Math.round(linear * (1 + pseudoRand)));
    result.push(val);
  }

  return result;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data = [],
  width = 68,
  height = 22,
  strokeWidth = 2,
  color = 'auto',
  showFill = true,
  showEndDot = true,
  showBadge = false,
  className = ''
}) => {
  const gradientId = useId();

  // If data is empty or all zeroes, render clean flat baseline
  const validData = Array.isArray(data) && data.length > 0 ? data : [0, 0];
  const firstVal = validData[0];
  const lastVal = validData[validData.length - 1];
  const isUp = lastVal >= firstVal;

  // Determine color scheme
  let strokeColor = '#3b82f6';
  let fillColor = '#60a5fa';
  if (color === 'emerald' || (color === 'auto' && isUp)) {
    strokeColor = '#10b981';
    fillColor = '#34d399';
  } else if (color === 'rose' || (color === 'auto' && !isUp)) {
    strokeColor = '#f43f5e';
    fillColor = '#fb7185';
  } else if (color === 'amber') {
    strokeColor = '#f59e0b';
    fillColor = '#fbbf24';
  } else if (color === 'indigo') {
    strokeColor = '#6366f1';
    fillColor = '#818cf8';
  } else if (color === 'purple') {
    strokeColor = '#8b5cf6';
    fillColor = '#a78bfa';
  } else if (color === 'cyan') {
    strokeColor = '#06b6d4';
    fillColor = '#67e8f9';
  }

  // Calculate coordinates with margins so strokes aren't clipped
  const padX = 3;
  const padY = 3;
  const effW = Math.max(10, width - padX * 2);
  const effH = Math.max(10, height - padY * 2);

  const minVal = Math.min(...validData);
  const maxVal = Math.max(...validData);
  const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const points = validData.map((val, idx) => {
    const x = padX + (idx / Math.max(1, validData.length - 1)) * effW;
    const y = padY + effH - ((val - minVal) / range) * effH;
    return { x, y };
  });

  // Build smooth Bezier SVG path
  let pathD = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    pathD += ` C ${midX.toFixed(2)} ${prev.y.toFixed(2)}, ${midX.toFixed(2)} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
  }

  // Area path for gradient fill
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaD = `${pathD} L ${lastPoint.x.toFixed(2)} ${height} L ${firstPoint.x.toFixed(2)} ${height} Z`;

  // Trend percent
  const pctChange = firstVal === 0
    ? (lastVal > 0 ? 100 : 0)
    : Math.round(((lastVal - firstVal) / firstVal) * 100);

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible select-none shrink-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={fillColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Gradient Area Fill */}
        {showFill && <path d={areaD} fill={`url(#${gradientId})`} />}

        {/* Sparkline Stroke */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-xs"
        />

        {/* Glowing End Dot */}
        {showEndDot && (
          <g>
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={strokeWidth + 2.5}
              fill={strokeColor}
              opacity={0.25}
              className="animate-ping"
              style={{ transformOrigin: `${lastPoint.x}px ${lastPoint.y}px` }}
            />
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={strokeWidth}
              fill={strokeColor}
              stroke="#ffffff"
              strokeWidth={1}
            />
          </g>
        )}
      </svg>

      {/* Optional Trend Percentage Badge */}
      {showBadge && (
        <span
          className={`text-[9.5px] font-mono font-bold px-1 py-0.2 rounded ${
            isUp
              ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400'
              : 'text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400'
          }`}
        >
          {isUp ? `+${pctChange}%` : `${pctChange}%`}
        </span>
      )}
    </div>
  );
};

export default Sparkline;

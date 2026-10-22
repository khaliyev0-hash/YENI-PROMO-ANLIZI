import React from 'react';

interface AnimatedLinesProps {
  color?: 'blue' | 'brand' | 'amber' | 'emerald' | 'rose' | 'slate' | 'white';
  count?: number;
  className?: string;
}

export const AnimatedLines: React.FC<AnimatedLinesProps> = ({
  color = 'blue',
  count = 5,
  className = ''
}) => {
  const colorMap = {
    blue: 'bg-blue-500',
    brand: 'bg-blue-500',
    amber: 'bg-amber-400',
    emerald: 'bg-emerald-400',
    rose: 'bg-rose-400',
    slate: 'bg-slate-900',
    white: 'bg-white'
  };

  const heights = ['h-3.5', 'h-5', 'h-2.5', 'h-4', 'h-2', 'h-4.5', 'h-3'];
  const durations = ['0.5s', '0.8s', '0.6s', '0.9s', '0.7s', '0.4s', '0.75s'];

  return (
    <div className={`flex items-end space-x-1 h-5 shrink-0 ${className}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <span
          key={idx}
          className={`w-1 rounded-full animate-bounce ${colorMap[color]} ${heights[idx % heights.length]}`}
          style={{ animationDuration: durations[idx % durations.length] }}
        />
      ))}
    </div>
  );
};

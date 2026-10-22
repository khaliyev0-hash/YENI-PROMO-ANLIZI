import React, { useState, useEffect, useRef } from 'react';

export interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * AnimatedCounter: Smoothly animates numeric changes using requestAnimationFrame
 * with an ease-out cubic easing curve. Supports formatting with commas and decimals.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 850,
  decimals,
  prefix = '',
  suffix = '',
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    return typeof value === 'number' ? value.toLocaleString() : String(value);
  });
  const prevValueRef = useRef<number>(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // Parse numeric value from string or number
    let targetNum: number;
    let autoDecimals = decimals;

    if (typeof value === 'number') {
      targetNum = value;
      if (autoDecimals === undefined) {
        autoDecimals = Number.isInteger(value) ? 0 : 1;
      }
    } else {
      const cleaned = String(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleaned);
      if (isNaN(parsed)) {
        setDisplayValue(String(value));
        return;
      }
      targetNum = parsed;
      if (autoDecimals === undefined) {
        const parts = cleaned.split('.');
        autoDecimals = parts.length > 1 ? parts[1].length : 0;
      }
    }

    const startNum = prevValueRef.current;
    const startTime = performance.now();
    const effectiveDecimals = autoDecimals !== undefined ? autoDecimals : 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic curve: 1 - (1 - t)^3
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startNum + (targetNum - startNum) * easeOut;

      let formatted: string;
      if (effectiveDecimals > 0) {
        const fixed = current.toFixed(effectiveDecimals);
        const [intPart, decPart] = fixed.split('.');
        formatted = `${Number(intPart).toLocaleString()}.${decPart}`;
      } else {
        formatted = Math.round(current).toLocaleString();
      }

      setDisplayValue(formatted);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = targetNum;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration, decimals]);

  return (
    <span className={className}>
      {prefix}{displayValue}{suffix}
    </span>
  );
};

export default AnimatedCounter;

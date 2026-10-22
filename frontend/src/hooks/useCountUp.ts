import { useState, useEffect, useRef } from 'react';

/**
 * Custom React hook for animating numeric count-ups.
 * Parses formatted string values like "51,700 u", "₼ 129,250", "84.4%"
 * and smoothly animates from 0 to target value using requestAnimationFrame.
 */
export function useCountUp(value: string | number, duration: number = 850): string {
  const [displayValue, setDisplayValue] = useState<string>('0');
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const valStr = String(value);

    // Match prefix, numeric part, and suffix
    const match = valStr.match(/^([^\d-]*)([\d,.]+)(.*)$/);

    if (!match) {
      setDisplayValue(valStr);
      return;
    }

    const prefix = match[1] || '';
    const numRaw = match[2].replace(/,/g, '');
    const suffix = match[3] || '';

    const targetNum = parseFloat(numRaw);
    if (isNaN(targetNum)) {
      setDisplayValue(valStr);
      return;
    }

    const hasComma = match[2].includes(',');
    const decimalParts = numRaw.split('.');
    const decimals = decimalParts.length > 1 ? decimalParts[1].length : 0;

    const startTime = performance.now();
    const startNum = 0;

    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic formula
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentNum = startNum + (targetNum - startNum) * easeOut;

      let formattedNum = decimals > 0 ? currentNum.toFixed(decimals) : Math.round(currentNum).toString();
      if (hasComma) {
        const parts = formattedNum.split('.');
        parts[0] = Number(parts[0]).toLocaleString('en-US');
        formattedNum = parts.join('.');
      }

      setDisplayValue(`${prefix}${formattedNum}${suffix}`);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(update);
      }
    };

    frameRef.current = requestAnimationFrame(update);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration]);

  return displayValue;
}

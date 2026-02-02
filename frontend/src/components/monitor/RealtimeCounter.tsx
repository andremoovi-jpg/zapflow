import { useState, useEffect } from 'react';

interface RealtimeCounterProps {
  value: number;
  suffix?: string;
  decimals?: number;
  className?: string;
}

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function RealtimeCounter({ 
  value, 
  suffix = '', 
  decimals = 1,
  className = '' 
}: RealtimeCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const start = displayValue;
    const end = value;
    const duration = 500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setDisplayValue(start + (end - start) * easeOutQuad(progress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span className={className}>
      {displayValue.toFixed(decimals)}{suffix}
    </span>
  );
}

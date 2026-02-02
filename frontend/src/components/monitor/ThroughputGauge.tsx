import { cn } from '@/lib/utils';

interface ThroughputGaugeProps {
  current: number;
  max: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ThroughputGauge({ 
  current, 
  max, 
  size = 'md',
  className 
}: ThroughputGaugeProps) {
  const percentage = Math.min((current / max) * 100, 100);
  
  const getColor = () => {
    if (percentage > 60) return 'text-green-500';
    if (percentage > 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  const sizeMap = {
    sm: { container: 'w-20 h-20', radius: 32, strokeWidth: 8, textSize: 'text-lg' },
    md: { container: 'w-32 h-32', radius: 56, strokeWidth: 12, textSize: 'text-2xl' },
    lg: { container: 'w-40 h-40', radius: 70, strokeWidth: 14, textSize: 'text-3xl' },
  };

  const { container, radius, strokeWidth, textSize } = sizeMap[size];
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
  const center = radius + strokeWidth;
  const viewBox = `0 0 ${center * 2} ${center * 2}`;

  return (
    <div className={cn("relative", container, className)}>
      <svg className="transform -rotate-90 w-full h-full" viewBox={viewBox}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          className={cn("transition-all duration-500", getColor())}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold", textSize)}>{current.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">/s</span>
      </div>
    </div>
  );
}

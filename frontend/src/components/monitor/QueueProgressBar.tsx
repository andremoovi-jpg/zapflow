import { cn } from '@/lib/utils';

interface QueueProgressBarProps {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  className?: string;
  showLabels?: boolean;
}

export function QueueProgressBar({ 
  waiting, 
  active, 
  completed, 
  failed,
  className,
  showLabels = false,
}: QueueProgressBarProps) {
  const total = waiting + active + completed + failed;
  
  if (total === 0) {
    return (
      <div className={cn("h-2 rounded-full bg-muted", className)} />
    );
  }

  const segments = [
    { value: completed, color: 'bg-green-500', label: 'Concluídos' },
    { value: active, color: 'bg-blue-500', label: 'Processando' },
    { value: waiting, color: 'bg-yellow-500', label: 'Aguardando' },
    { value: failed, color: 'bg-red-500', label: 'Falhas' },
  ];

  return (
    <div className="space-y-1">
      <div className={cn("flex h-2 rounded-full overflow-hidden", className)}>
        {segments.map((segment, index) => (
          segment.value > 0 && (
            <div
              key={index}
              className={cn(segment.color, "transition-all duration-300")}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          )
        ))}
      </div>
      {showLabels && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          {segments.map((segment, index) => (
            segment.value > 0 && (
              <div key={index} className="flex items-center gap-1">
                <div className={cn("w-2 h-2 rounded-full", segment.color)} />
                <span>{segment.label}: {segment.value.toLocaleString()}</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

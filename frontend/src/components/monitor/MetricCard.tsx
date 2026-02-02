import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { RealtimeCounter } from './RealtimeCounter';

interface MetricCardProps {
  title: string;
  value: number;
  suffix?: string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'default';
  children?: React.ReactNode;
}

export function MetricCard({
  title,
  value,
  suffix = '',
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'default',
  children,
}: MetricCardProps) {
  const colorClasses = {
    green: 'border-green-500/50 bg-green-500/5',
    yellow: 'border-yellow-500/50 bg-yellow-500/5',
    red: 'border-red-500/50 bg-red-500/5',
    blue: 'border-blue-500/50 bg-blue-500/5',
    default: '',
  };

  const iconColorClasses = {
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500',
    blue: 'text-blue-500',
    default: 'text-muted-foreground',
  };

  return (
    <Card className={cn("transition-colors", colorClasses[color])}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1">
              <RealtimeCounter 
                value={value} 
                suffix={suffix} 
                className="text-3xl font-bold"
                decimals={suffix === '/s' || suffix === '%' ? 1 : 0}
              />
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
            {trend && trendValue && (
              <div className={cn(
                "text-sm font-medium",
                trend === 'up' && "text-green-500",
                trend === 'down' && "text-red-500",
                trend === 'neutral' && "text-muted-foreground"
              )}>
                {trend === 'up' && '↑'}
                {trend === 'down' && '↓'}
                {' '}{trendValue}
              </div>
            )}
          </div>
          {Icon && (
            <Icon className={cn("h-8 w-8", iconColorClasses[color])} />
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QueueProgressBar } from './QueueProgressBar';
import { WhatsAppAccount } from '@/contexts/WABAContext';
import { QueueStatus } from '@/hooks/useQueueMetrics';
import { Pause, Play, RefreshCw, Eye, Server, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WABAQueueCardProps {
  waba: WhatsAppAccount;
  queueStatus: QueueStatus | null;
  onPause?: () => void;
  onResume?: () => void;
  onRetryFailed?: () => void;
  onViewDetails?: () => void;
  isPaused?: boolean;
  workersCount?: number;
}

export function WABAQueueCard({
  waba,
  queueStatus,
  onPause,
  onResume,
  onRetryFailed,
  onViewDetails,
  isPaused = false,
  workersCount = 0,
}: WABAQueueCardProps) {
  const latest = queueStatus?.latest;
  const todayStats = queueStatus?.todayStats;

  const getHealthColor = () => {
    if (!latest) return 'bg-gray-500';
    if (latest.throughput > 30) return 'bg-green-500';
    if (latest.throughput > 10) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getHealthLabel = () => {
    if (!latest) return 'Sem dados';
    if (latest.throughput > 30) return 'Saudável';
    if (latest.throughput > 10) return 'Moderado';
    return 'Lento';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", getHealthColor())} />
            <CardTitle className="text-base">{waba.name}</CardTitle>
          </div>
          <Badge variant="outline">{getHealthLabel()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Queue Stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Aguardando:</span>
            <span className="font-medium">{latest?.waiting?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Processando:</span>
            <span className="font-medium">{latest?.active || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Concluídos (hoje):</span>
            <span className="font-medium text-green-600">
              {todayStats?.totalCompleted?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Falhas:</span>
            <span className={cn(
              "font-medium",
              (todayStats?.totalFailed || 0) > 0 ? "text-red-600" : "text-muted-foreground"
            )}>
              {todayStats?.totalFailed?.toLocaleString() || 0}
              {todayStats?.totalCompleted && todayStats.totalCompleted > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({((todayStats.totalFailed / (todayStats.totalCompleted + todayStats.totalFailed)) * 100).toFixed(2)}%)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <QueueProgressBar
          waiting={latest?.waiting || 0}
          active={latest?.active || 0}
          completed={todayStats?.totalCompleted || 0}
          failed={todayStats?.totalFailed || 0}
        />

        {/* Performance */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Throughput:</span>
            <span className="font-medium">
              {latest?.throughput?.toFixed(1) || 0}/s 
              <span className="text-muted-foreground ml-1">(max: {waba.rate_limit_per_second}/s)</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Server className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Workers: {workersCount} ativos</span>
          </div>
          {waba.proxy_enabled && (
            <div className="flex items-center gap-2 text-sm">
              <Wifi className="h-3 w-3 text-green-500" />
              <span className="text-muted-foreground">Proxy ativo</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {isPaused ? (
            <Button size="sm" variant="outline" onClick={onResume}>
              <Play className="h-4 w-4 mr-1" />
              Retomar
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onPause}>
              <Pause className="h-4 w-4 mr-1" />
              Pausar
            </Button>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onRetryFailed}
            disabled={(todayStats?.totalFailed || 0) === 0}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Retentar
          </Button>
          <Button size="sm" variant="ghost" onClick={onViewDetails}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

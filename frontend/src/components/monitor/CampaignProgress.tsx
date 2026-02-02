import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pause, XCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RealtimeCounter } from './RealtimeCounter';
import { Json } from '@/integrations/supabase/types';

interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

interface Campaign {
  id: string;
  name: string;
  status: string | null;
  audience_count: number | null;
  stats: Json | null;
  started_at: string | null;
}

interface CampaignProgressProps {
  campaign: Campaign;
  throughput?: number;
  onPause?: () => void;
  onCancel?: () => void;
  onPrioritize?: () => void;
}

function parseCampaignStats(stats: Json | null): CampaignStats {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    return { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
  }
  const obj = stats as Record<string, unknown>;
  return {
    total: typeof obj.total === 'number' ? obj.total : 0,
    sent: typeof obj.sent === 'number' ? obj.sent : 0,
    delivered: typeof obj.delivered === 'number' ? obj.delivered : 0,
    read: typeof obj.read === 'number' ? obj.read : 0,
    failed: typeof obj.failed === 'number' ? obj.failed : 0,
  };
}

export function CampaignProgress({
  campaign,
  throughput = 0,
  onPause,
  onCancel,
  onPrioritize,
}: CampaignProgressProps) {
  const stats = parseCampaignStats(campaign.stats);
    
  const total = campaign.audience_count || stats.total || 0;
  const sent = stats.sent || 0;
  const failed = stats.failed || 0;
  const progress = total > 0 ? (sent / total) * 100 : 0;
  const successRate = sent > 0 ? ((sent - failed) / sent * 100).toFixed(1) : '-';
  
  // Estimate remaining time
  const remaining = total - sent;
  const estimatedMinutes = throughput > 0 ? Math.ceil(remaining / throughput / 60) : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Campanha: {campaign.name}</h4>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={onPause}>
                <Pause className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                <XCircle className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onPrioritize}>
                <Zap className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso:</span>
              <span className="font-medium">
                {progress.toFixed(0)}% ({sent.toLocaleString()} / {total.toLocaleString()})
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Velocidade</p>
              <p className="font-medium">
                <RealtimeCounter value={throughput} suffix="/s" />
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Tempo restante</p>
              <p className="font-medium">
                {estimatedMinutes > 0 ? `~${estimatedMinutes} min` : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Sucesso</p>
              <p className={cn(
                "font-medium",
                successRate !== '-' && Number(successRate) >= 99 && "text-green-600",
                successRate !== '-' && Number(successRate) < 99 && "text-yellow-600"
              )}>
                {successRate !== '-' ? `${successRate}%` : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Falhas</p>
              <p className={cn(
                "font-medium",
                failed > 0 ? "text-red-600" : "text-muted-foreground"
              )}>
                {failed.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

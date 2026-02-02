import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useWABA } from '@/contexts/WABAContext';
import {
  useQueueStatus,
  useRealtimeMetrics,
  usePhoneNumbersWithMetrics,
  useRunningCampaigns,
  usePauseQueue,
  useResumeQueue,
  useRetryFailed,
  useQueuePaused,
  useQueueWorkers,
  useQueueErrors
} from '@/hooks/useQueueMetrics';
import { MetricCard } from '@/components/monitor/MetricCard';
import { ThroughputChart } from '@/components/monitor/ThroughputChart';
import { WABAQueueCard } from '@/components/monitor/WABAQueueCard';
import { PhoneNumbersTable } from '@/components/monitor/PhoneNumbersTable';
import { CampaignProgress } from '@/components/monitor/CampaignProgress';
import { ThroughputGauge } from '@/components/monitor/ThroughputGauge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertTriangle,
  Gauge,
  Timer,
  TrendingUp
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type RefreshInterval = '5' | '10' | '30' | 'off';

export default function Monitor() {
  const { selectedWABA, availableWABAs, setSelectedWABA, loading: wabaLoading } = useWABA();
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>('5');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: queueStatus, isLoading: queueLoading } = useQueueStatus(selectedWABA?.id);
  const realtimeMetrics = useRealtimeMetrics(autoRefresh ? selectedWABA?.id : undefined);
  const { data: phonesWithMetrics, isLoading: phonesLoading } = usePhoneNumbersWithMetrics(selectedWABA?.id);
  const { data: runningCampaigns } = useRunningCampaigns();
  const { data: queuePausedData } = useQueuePaused();
  const { data: workersData } = useQueueWorkers();
  const { data: errorsData } = useQueueErrors(10);

  const pauseQueue = usePauseQueue();
  const resumeQueue = useResumeQueue();
  const retryFailed = useRetryFailed();

  const isPaused = queuePausedData?.paused || false;
  const workersCount = workersData?.count || 0;
  const recentErrors = errorsData?.errors || [];

  const latest = queueStatus?.latest;
  const todayStats = queueStatus?.todayStats;

  // Calculate metrics
  const currentThroughput = latest?.throughput || 0;
  const maxThroughput = selectedWABA?.rate_limit_per_second || 80;
  const waitingCount = latest?.waiting || 0;
  const activeCount = latest?.active || 0;
  const totalCompleted = todayStats?.totalCompleted || 0;
  const totalFailed = todayStats?.totalFailed || 0;
  const successRate = totalCompleted + totalFailed > 0
    ? (totalCompleted / (totalCompleted + totalFailed)) * 100
    : 100;
  const avgProcessingTime = latest?.avgProcessingTime || 0;

  // Determine throughput color
  const getThroughputColor = (): 'green' | 'yellow' | 'red' => {
    if (currentThroughput > 30) return 'green';
    if (currentThroughput > 10) return 'yellow';
    return 'red';
  };

  // Determine success rate color
  const getSuccessColor = (): 'green' | 'yellow' | 'red' => {
    if (successRate >= 99) return 'green';
    if (successRate >= 95) return 'yellow';
    return 'red';
  };

  const handlePauseQueue = async () => {
    try {
      await pauseQueue.mutateAsync();
      toast({ title: 'Fila pausada', description: 'A fila de envio foi pausada.' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível pausar a fila.', variant: 'destructive' });
    }
  };

  const handleResumeQueue = async () => {
    try {
      await resumeQueue.mutateAsync();
      toast({ title: 'Fila retomada', description: 'A fila de envio foi retomada.' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível retomar a fila.', variant: 'destructive' });
    }
  };

  const handleRetryFailed = async () => {
    try {
      const result = await retryFailed.mutateAsync();
      toast({ title: 'Reprocessando', description: `${result.retried} mensagens sendo reprocessadas.` });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível reprocessar as mensagens.', variant: 'destructive' });
    }
  };

  if (wabaLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Monitor de Performance</h1>
            <p className="text-muted-foreground">
              Acompanhe o envio de mensagens em tempo real
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* WABA Selector */}
            {availableWABAs.length > 1 && (
              <Select
                value={selectedWABA?.id}
                onValueChange={(value) => {
                  const waba = availableWABAs.find(w => w.id === value);
                  if (waba) setSelectedWABA(waba);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecionar WABA" />
                </SelectTrigger>
                <SelectContent>
                  {availableWABAs.map((waba) => (
                    <SelectItem key={waba.id} value={waba.id}>
                      {waba.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                aria-label="Auto-refresh"
              />
              <Label htmlFor="auto-refresh" className="text-sm">Auto</Label>
            </div>

            {/* Refresh interval */}
            <Select
              value={refreshInterval}
              onValueChange={(v) => setRefreshInterval(v as RefreshInterval)}
              disabled={!autoRefresh}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5s</SelectItem>
                <SelectItem value="10">10s</SelectItem>
                <SelectItem value="30">30s</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Real-time Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Throughput Atual"
            value={currentThroughput}
            suffix="/s"
            subtitle={`Max: ${maxThroughput}/s`}
            icon={Gauge}
            color={getThroughputColor()}
          >
            <div className="mt-4">
              <ThroughputGauge current={currentThroughput} max={maxThroughput} size="sm" />
            </div>
          </MetricCard>

          <MetricCard
            title="Fila Atual"
            value={waitingCount}
            subtitle={`${activeCount} processando`}
            icon={Clock}
            color={waitingCount > 1000 ? 'yellow' : 'default'}
          />

          <MetricCard
            title="Taxa de Sucesso"
            value={successRate}
            suffix="%"
            subtitle={`${totalCompleted.toLocaleString()} entregues hoje`}
            icon={CheckCircle}
            color={getSuccessColor()}
          />

          <MetricCard
            title="Tempo Médio"
            value={avgProcessingTime}
            suffix="ms"
            subtitle="por mensagem"
            icon={Timer}
            color={avgProcessingTime > 500 ? 'yellow' : 'default'}
          />
        </div>

        {/* Throughput Chart */}
        {realtimeMetrics.length > 0 && (
          <ThroughputChart
            data={realtimeMetrics}
            maxThroughput={maxThroughput}
            title="Throughput em Tempo Real (últimos 5 minutos)"
          />
        )}

        {/* WABA Queue Cards */}
        {availableWABAs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Status das Filas por WABA</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableWABAs.map((waba) => (
                <WABAQueueCard
                  key={waba.id}
                  waba={waba}
                  queueStatus={waba.id === selectedWABA?.id ? queueStatus : null}
                  onPause={handlePauseQueue}
                  onResume={handleResumeQueue}
                  onRetryFailed={handleRetryFailed}
                  onViewDetails={() => {
                    setSelectedWABA(waba);
                  }}
                  isPaused={isPaused}
                  workersCount={workersCount}
                />
              ))}
            </div>
          </div>
        )}

        {/* Running Campaigns */}
        {runningCampaigns && runningCampaigns.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Campanhas em Andamento</h2>
            <div className="space-y-4">
              {runningCampaigns.map((campaign) => (
                <CampaignProgress
                  key={campaign.id}
                  campaign={campaign}
                  throughput={currentThroughput}
                  onPause={() => toast({ title: 'Campanha pausada' })}
                  onCancel={() => toast({ title: 'Campanha cancelada', variant: 'destructive' })}
                  onPrioritize={() => toast({ title: 'Campanha priorizada' })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Phone Numbers Performance */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Performance por Número de Telefone</h2>
          {phonesLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <PhoneNumbersTable
              phones={phonesWithMetrics || []}
              onViewDetails={(phoneId) => {
                toast({ title: 'Ver detalhes', description: `Abrindo detalhes do número ${phoneId}` });
              }}
              onReactivate={(phoneId) => {
                toast({ title: 'Reativando', description: 'O número está sendo reativado.' });
              }}
            />
          )}
        </div>

        {/* Error Log */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Log de Erros em Tempo Real
              </CardTitle>
              <Badge variant="outline">{recentErrors.length} nos últimos 10 min</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {recentErrors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>Nenhum erro registrado</p>
                <p className="text-sm">Os erros aparecerão aqui em tempo real</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentErrors.map((error) => (
                  <div key={error.id} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400 truncate">
                        {error.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(error.created_at).toLocaleTimeString('pt-BR')}
                        {error.campaign_id && ` • Campanha: ${error.campaign_id.slice(0, 8)}...`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

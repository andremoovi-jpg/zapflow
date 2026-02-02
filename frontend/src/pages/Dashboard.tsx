import { 
  MessageSquare, 
  Users, 
  Send, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  ArrowUpRight,
  Gauge,
  Activity,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useDashboardMetrics, useMessagesPerDay, useTopFlows, useMessageStatusDistribution, useRecentActivity, usePendingConversations } from '@/hooks/useDashboard';
import { useRunningCampaigns } from '@/hooks/useQueueMetrics';
import { useWhatsAppAccounts } from '@/hooks/useWhatsAppAccounts';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { MessagesChart } from '@/components/dashboard/MessagesChart';
import { TopFlowsChart } from '@/components/dashboard/TopFlowsChart';
import { MessageStatusChart } from '@/components/dashboard/MessageStatusChart';
import { RecentActivityList } from '@/components/dashboard/RecentActivityList';
import { PendingConversationsList } from '@/components/dashboard/PendingConversationsList';
import { MetricCard } from '@/components/dashboard/MetricCard';

export default function Dashboard() {
  const { currentOrg } = useOrganization();
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: messagesPerDay, isLoading: messagesLoading } = useMessagesPerDay();
  const { data: topFlows, isLoading: flowsLoading } = useTopFlows();
  const { data: statusDistribution, isLoading: statusLoading } = useMessageStatusDistribution();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity();
  const { data: pendingConversations, isLoading: pendingLoading } = usePendingConversations();
  const { data: runningCampaigns, isLoading: campaignsLoading } = useRunningCampaigns();
  const { data: wabaAccounts, isLoading: wabasLoading } = useWhatsAppAccounts();

  // Calculate queue health from WABA accounts
  const queueHealth = wabaAccounts?.reduce((acc, waba) => {
    if (waba.health_status === 'healthy') acc.healthy++;
    else if (waba.health_status === 'degraded') acc.degraded++;
    else acc.unhealthy++;
    return acc;
  }, { healthy: 0, degraded: 0, unhealthy: 0 }) || { healthy: 0, degraded: 0, unhealthy: 0 };

  const hasQueueIssues = queueHealth.degraded > 0 || queueHealth.unhealthy > 0;

  // Calculate change percentage
  const messagesTodayChange = metrics?.messages_yesterday 
    ? ((metrics.messages_today - metrics.messages_yesterday) / metrics.messages_yesterday * 100)
    : undefined;

  return (
    <DashboardLayout 
      breadcrumbs={[
        { label: currentOrg?.name || 'Organização' },
        { label: 'Dashboard' },
      ]}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bom dia! 👋</h1>
            <p className="text-muted-foreground">
              Aqui está um resumo das suas atividades hoje.
            </p>
          </div>
          <Button asChild>
            <Link to="/campaigns/new">
              Nova Campanha
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Stats Grid - Top Row with Performance Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Mensagens Hoje */}
          <MetricCard
            title="Mensagens Hoje"
            value={metrics?.messages_today ?? 0}
            icon={Send}
            change={messagesTodayChange}
            changeLabel="vs ontem"
            loading={metricsLoading}
          />

          {/* Contatos Ativos */}
          <MetricCard
            title="Contatos Ativos"
            value={metrics?.active_contacts ?? 0}
            icon={Users}
            loading={metricsLoading}
          />

          {/* Fluxos Ativos */}
          <MetricCard
            title="Fluxos Ativos"
            value={metrics?.active_flows ?? 0}
            icon={TrendingUp}
            loading={metricsLoading}
          />

          {/* Taxa de Entrega */}
          <MetricCard
            title="Taxa de Entrega"
            value={`${metrics?.delivery_rate ?? 0}%`}
            icon={CheckCircle2}
            loading={metricsLoading}
          />

          {/* Throughput Médio - NEW */}
          <MetricCard
            title="Throughput Médio"
            value="34.5/s"
            icon={Gauge}
            loading={wabasLoading}
          />

          {/* Saúde das Filas - NEW */}
          <Card className="relative overflow-hidden">
            <CardContent className="p-6">
              {wabasLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Saúde das Filas</p>
                    <p className={`text-3xl font-bold tracking-tight ${hasQueueIssues ? 'text-warning' : 'text-success'}`}>
                      {hasQueueIssues ? `${queueHealth.degraded + queueHealth.unhealthy}` : '✓'}
                    </p>
                    <p className={`text-xs font-medium ${hasQueueIssues ? 'text-warning' : 'text-success'}`}>
                      {hasQueueIssues ? 'com problema' : 'Todas saudáveis'}
                    </p>
                  </div>
                  <Link 
                    to="/monitor" 
                    className={`rounded-lg p-3 ${hasQueueIssues ? 'bg-warning/10' : 'bg-success/10'}`}
                  >
                    {hasQueueIssues ? (
                      <AlertCircle className="h-5 w-5 text-warning" />
                    ) : (
                      <Activity className="h-5 w-5 text-success" />
                    )}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance by WABA and Running Campaigns */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Performance por WABA */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Performance das Contas</CardTitle>
              <Button variant="ghost" size="sm" className="text-primary" asChild>
                <Link to="/monitor">
                  Ver detalhes
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {wabasLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-2 flex-1" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                  </div>
                ))
              ) : wabaAccounts && wabaAccounts.length > 0 ? (
                wabaAccounts.map((waba) => {
                  // Mock throughput - in real app this would come from metrics
                  const throughput = Math.random() * 60 + 10;
                  const maxThroughput = waba.rate_limit_per_second || 80;
                  const percentage = (throughput / maxThroughput) * 100;
                  const healthColor = waba.health_status === 'healthy' 
                    ? 'bg-success' 
                    : waba.health_status === 'degraded' 
                    ? 'bg-warning' 
                    : 'bg-destructive';
                  
                  return (
                    <div key={waba.id} className="flex items-center gap-4 py-2">
                      <span className="text-sm font-medium w-28 truncate" title={waba.name}>
                        {waba.name}
                      </span>
                      <div className="flex-1">
                        <Progress value={percentage} className="h-2" />
                      </div>
                      <span className="text-sm font-medium w-20 text-right">
                        {throughput.toFixed(1)}/s
                      </span>
                      <div className={`h-3 w-3 rounded-full ${healthColor}`} />
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma conta WhatsApp conectada
                </p>
              )}
            </CardContent>
          </Card>

          {/* Campanhas em Andamento */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Campanhas em Andamento</CardTitle>
              <Button variant="ghost" size="sm" className="text-primary" asChild>
                <Link to="/campaigns">Ver todas</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {campaignsLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-lg border border-border/50 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))
              ) : runningCampaigns && runningCampaigns.length > 0 ? (
                runningCampaigns.slice(0, 3).map((campaign) => {
                  const stats = campaign.stats as { sent?: number; total?: number } | null;
                  const sent = stats?.sent || 0;
                  const total = stats?.total || campaign.audience_count || 1;
                  const percentage = (sent / total) * 100;
                  const speed = (campaign.send_rate || 50) * 0.8; // Approximate current speed
                  const remaining = total - sent;
                  const minutesRemaining = remaining > 0 ? Math.ceil(remaining / (speed * 60)) : 0;
                  
                  return (
                    <div key={campaign.id} className="p-4 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium truncate">{campaign.name}</p>
                        <span className="text-sm text-muted-foreground">{speed.toFixed(0)}/s</span>
                      </div>
                      <Progress value={percentage} className="h-2 mb-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{percentage.toFixed(0)}% ({sent.toLocaleString()} / {total.toLocaleString()})</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          ~{minutesRemaining} min restantes
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma campanha em andamento
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Messages Chart */}
          <div className="lg:col-span-2">
            <MessagesChart data={messagesPerDay || []} loading={messagesLoading} />
          </div>

          {/* Message Status Distribution */}
          <MessageStatusChart data={statusDistribution || []} loading={statusLoading} />
        </div>

        {/* Top Flows */}
        <TopFlowsChart data={topFlows || []} loading={flowsLoading} />

        {/* Activity and Pending */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentActivityList data={recentActivity || []} loading={activityLoading} />
          <PendingConversationsList data={pendingConversations || []} loading={pendingLoading} />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Criar Fluxo', icon: TrendingUp, color: 'text-primary', href: '/flows' },
                { label: 'Importar Contatos', icon: Users, color: 'text-info', href: '/contacts' },
                { label: 'Ver Templates', icon: MessageSquare, color: 'text-success', href: '/templates' },
                { label: 'Disparar Campanha', icon: Send, color: 'text-warning', href: '/campaigns/new' },
              ].map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-accent hover:border-primary/30"
                  asChild
                >
                  <Link to={action.href}>
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                    <span>{action.label}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

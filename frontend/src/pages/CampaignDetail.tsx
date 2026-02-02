import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Pause,
  Play,
  Copy,
  X,
  Send,
  CheckCircle2,
  Eye,
  AlertCircle,
  Search,
  Clock,
  Activity,
  Filter,
  List
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useCampaign,
  useCampaignMessages,
  useCampaignRealtime,
  useCampaignMetrics,
  useUpdateCampaign,
  useDuplicateCampaign,
  useStartCampaign,
  useCampaignFunnel
} from '@/hooks/useCampaigns';
import { CampaignFunnel } from '@/components/campaigns/CampaignFunnel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: campaign, isLoading } = useCampaign(id);
  const { data: messages = [], isLoading: messagesLoading } = useCampaignMessages(id, {
    status: statusFilter,
    search: searchQuery
  });
  const { data: metricsData } = useCampaignMetrics(id);
  const updateCampaign = useUpdateCampaign();
  const duplicateCampaign = useDuplicateCampaign();
  const startCampaign = useStartCampaign();

  // Enable real-time updates
  useCampaignRealtime(id);

  // Preparar dados do gráfico
  const chartData = metricsData?.history?.map((point) => ({
    time: format(new Date(point.recorded_at), 'HH:mm:ss'),
    velocidade: point.messages_per_second,
    enviadas: point.total_sent,
    entregues: point.total_delivered,
    falhas: point.total_failed,
  })) || [];

  if (isLoading) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Campanhas', href: '/campaigns' }, { label: 'Carregando...' }]}>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-5">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!campaign) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Campanhas', href: '/campaigns' }, { label: 'Não encontrada' }]}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Campanha não encontrada</p>
          <Button asChild className="mt-4">
            <Link to="/campaigns">Voltar para Campanhas</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const stats = campaign.stats;
  const progress = stats.total > 0 ? (stats.sent / stats.total) * 100 : 0;

  // Métricas de velocidade (do stats salvo ou do metricsData da API)
  const speedMetrics = metricsData?.summary || stats?.metrics || null;

  const handlePause = () => {
    updateCampaign.mutate({ id: campaign.id, status: 'paused' });
    toast.success('Campanha pausada');
  };

  const handleResume = () => {
    updateCampaign.mutate({ id: campaign.id, status: 'running' });
    toast.success('Campanha retomada');
  };

  const handleCancel = () => {
    updateCampaign.mutate({ id: campaign.id, status: 'cancelled' });
    toast.success('Campanha cancelada');
    navigate('/campaigns');
  };

  const handleDuplicate = async () => {
    const newCampaign = await duplicateCampaign.mutateAsync(campaign.id);
    navigate(`/campaigns/${newCampaign.id}`);
  };

  const handleStart = async () => {
    if (!campaign) return;
    await startCampaign.mutateAsync(campaign.id);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pendente' },
      running: { variant: 'default', label: 'Em andamento' },
      paused: { variant: 'outline', label: 'Pausada' },
      scheduled: { variant: 'secondary', label: 'Agendada' },
      completed: { variant: 'default', label: 'Concluída' },
      cancelled: { variant: 'destructive', label: 'Cancelada' },
      draft: { variant: 'outline', label: 'Rascunho' },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Send className="h-4 w-4 text-blue-500" />;
      case 'delivered': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'read': return <Eye className="h-4 w-4 text-primary" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <DashboardLayout 
      breadcrumbs={[
        { label: 'Campanhas', href: '/campaigns' },
        { label: campaign.name }
      ]}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/campaigns">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{campaign.name}</h1>
                {getStatusBadge(campaign.status)}
              </div>
              {campaign.scheduled_at && (
                <p className="text-sm text-muted-foreground mt-1">
                  Agendada para: {format(new Date(campaign.scheduled_at), "PPP 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {campaign.status === 'draft' && (
              <Button onClick={handleStart} disabled={startCampaign.isPending}>
                <Play className="h-4 w-4 mr-2" />
                {startCampaign.isPending ? 'Iniciando...' : 'Iniciar Campanha'}
              </Button>
            )}
            {campaign.status === 'running' && (
              <Button variant="outline" onClick={handlePause}>
                <Pause className="h-4 w-4 mr-2" />
                Pausar
              </Button>
            )}
            {campaign.status === 'paused' && (
              <Button variant="outline" onClick={handleResume}>
                <Play className="h-4 w-4 mr-2" />
                Retomar
              </Button>
            )}
            <Button variant="outline" onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </Button>
            {['draft', 'scheduled', 'running', 'paused'].includes(campaign.status) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar campanha?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Mensagens já enviadas não serão afetadas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel}>Cancelar Campanha</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-5">
          {[
            { label: 'Total', value: stats.total, icon: Users, color: 'text-foreground' },
            { label: 'Enviadas', value: stats.sent, icon: Send, color: 'text-blue-500' },
            { label: 'Entregues', value: stats.delivered, icon: CheckCircle2, color: 'text-green-500' },
            { label: 'Lidas', value: stats.read, icon: Eye, color: 'text-primary' },
            { label: 'Falhas', value: stats.failed, icon: AlertCircle, color: 'text-destructive' },
          ].map((metric, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <metric.icon className={`h-5 w-5 ${metric.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metric.value.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress */}
        {stats.total > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progresso do envio</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{stats.sent.toLocaleString()} enviadas</span>
                <span>{stats.total.toLocaleString()} total</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Speed Metrics Summary - sempre mostra quando tem dados */}
        {speedMetrics && (speedMetrics.avgSpeed > 0 || speedMetrics.duration > 0) && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle>Velocidade de Envio</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{(speedMetrics.avgSpeed || 0).toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">msg/s (média)</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{(speedMetrics.maxSpeed || 0).toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">msg/s (pico)</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{Math.floor((speedMetrics.duration || 0) / 60)}m {(speedMetrics.duration || 0) % 60}s</p>
                  <p className="text-sm text-muted-foreground">duração</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <CardTitle>Velocidade de Envio</CardTitle>
                </div>
                {speedMetrics && (
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground">Média</p>
                      <p className="font-semibold">{(speedMetrics.avgSpeed || 0).toFixed(1)} msg/s</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Pico</p>
                      <p className="font-semibold">{(speedMetrics.maxSpeed || 0).toFixed(1)} msg/s</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Duração</p>
                      <p className="font-semibold">{Math.floor((speedMetrics.duration || 0) / 60)}m {(speedMetrics.duration || 0) % 60}s</p>
                    </div>
                  </div>
                )}
                {metricsData?.realtime && (
                  <Badge variant="secondary" className="ml-2">
                    {metricsData.realtime.msgsPerSecond} msg/s agora
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorVelocidade" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      label={{ value: 'msg/s', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          velocidade: 'Velocidade',
                          enviadas: 'Total Enviadas',
                          entregues: 'Entregues',
                          falhas: 'Falhas',
                        };
                        return [value, labels[name] || name];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="velocidade"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorVelocidade)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs: Messages List & Funnel */}
        <Tabs defaultValue="messages" className="space-y-4">
          <TabsList>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Lista de Envios
            </TabsTrigger>
            <TabsTrigger value="funnel" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Funil de Ações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Envios</CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por telefone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-48"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="sent">Enviada</SelectItem>
                        <SelectItem value="delivered">Entregue</SelectItem>
                        <SelectItem value="read">Lida</SelectItem>
                        <SelectItem value="failed">Falha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {messagesLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum envio registrado ainda
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contato</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Enviada em</TableHead>
                        <TableHead>Entregue em</TableHead>
                        <TableHead>Lida em</TableHead>
                        <TableHead>Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {messages.map((msg) => (
                        <TableRow key={msg.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{msg.contact?.name || 'Sem nome'}</p>
                              <p className="text-sm text-muted-foreground">{msg.contact?.phone_number}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getMessageStatusIcon(msg.status)}
                              <span className="capitalize">{msg.status}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {msg.sent_at ? format(new Date(msg.sent_at), 'dd/MM HH:mm') : '-'}
                          </TableCell>
                          <TableCell>
                            {msg.delivered_at ? format(new Date(msg.delivered_at), 'dd/MM HH:mm') : '-'}
                          </TableCell>
                          <TableCell>
                            {msg.read_at ? format(new Date(msg.read_at), 'dd/MM HH:mm') : '-'}
                          </TableCell>
                          <TableCell>
                            {msg.error_message && (
                              <span className="text-destructive text-sm">{msg.error_message}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="funnel">
            <CampaignFunnel campaignId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Import Users icon that was missed
import { Users } from 'lucide-react';

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  Search,
  Flame,
  MoreHorizontal,
  Pause,
  Play,
  Settings,
  Trash2,
  Users,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useWarmingPools,
  useCreateWarmingPool,
  useDeleteWarmingPool,
  usePauseWarmingPool,
  useResumeWarmingPool,
  useWarmingPoolMembers,
  type WarmingPool,
} from '@/hooks/useWarmingPools';

export default function Warming() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [poolToDelete, setPoolToDelete] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolStrategy, setNewPoolStrategy] = useState('least_used');

  const { data: pools = [], isLoading } = useWarmingPools();
  const createPool = useCreateWarmingPool();
  const deletePool = useDeleteWarmingPool();
  const pausePool = usePauseWarmingPool();
  const resumePool = useResumeWarmingPool();

  const filteredPools = pools.filter((pool) => {
    const matchesSearch = pool.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pool.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreatePool = async () => {
    if (!newPoolName.trim()) return;

    await createPool.mutateAsync({
      name: newPoolName,
      rotation_strategy: newPoolStrategy,
    });

    setNewPoolName('');
    setNewPoolStrategy('least_used');
    setShowCreateModal(false);
  };

  const handleDelete = () => {
    if (poolToDelete) {
      deletePool.mutate(poolToDelete);
      setPoolToDelete(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      active: { variant: 'default', label: 'Ativo' },
      paused: { variant: 'secondary', label: 'Pausado' },
      completed: { variant: 'outline', label: 'Concluido' },
    };
    const { variant, label } = config[status || 'active'] || config.active;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getStrategyLabel = (strategy: string | null) => {
    const labels: Record<string, string> = {
      round_robin: 'Round Robin',
      least_used: 'Menor Uso',
      weighted: 'Por Peso',
      random: 'Aleatorio',
      quality_first: 'Qualidade Primeiro',
    };
    return labels[strategy || 'least_used'] || strategy;
  };

  // Calculate stats from all pools
  const totalStats = {
    activePools: pools.filter((p) => p.status === 'active').length,
    totalWabas: 0, // Will be calculated from members
    messagesToday: pools.reduce((acc, p) => acc + (p.total_messages_today || 0), 0),
    totalMessages: pools.reduce((acc, p) => acc + (p.total_messages_sent || 0), 0),
  };

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Aquecimento' }]}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Flame className="h-6 w-6 text-orange-500" />
              Aquecimento
            </h1>
            <p className="text-muted-foreground">
              Gerencie pools de aquecimento para distribuir mensagens entre WABAs
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Pool
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              label: 'Pools Ativos',
              value: totalStats.activePools,
              icon: Flame,
              color: 'text-orange-500',
            },
            {
              label: 'WABAs no Aquecimento',
              value: totalStats.totalWabas,
              icon: Users,
              color: 'text-blue-500',
            },
            {
              label: 'Mensagens Hoje',
              value: totalStats.messagesToday.toLocaleString(),
              icon: MessageSquare,
              color: 'text-green-500',
            },
            {
              label: 'Total Enviadas',
              value: totalStats.totalMessages.toLocaleString(),
              icon: Zap,
              color: 'text-purple-500',
            },
          ].map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-muted">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={statusFilter === 'all' ? 'outline' : 'ghost'}
            onClick={() => setStatusFilter('all')}
          >
            Todos
          </Button>
          <Button
            variant={statusFilter === 'active' ? 'outline' : 'ghost'}
            onClick={() => setStatusFilter('active')}
          >
            Ativos
          </Button>
          <Button
            variant={statusFilter === 'paused' ? 'outline' : 'ghost'}
            onClick={() => setStatusFilter('paused')}
          >
            Pausados
          </Button>
        </div>

        {/* Pools List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredPools.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Flame className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhum pool de aquecimento</p>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro pool para comecar a aquecer suas WABAs
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Pool
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPools.map((pool) => (
              <PoolCard
                key={pool.id}
                pool={pool}
                onPause={() => pausePool.mutate(pool.id)}
                onResume={() => resumePool.mutate(pool.id)}
                onDelete={() => setPoolToDelete(pool.id)}
                getStatusBadge={getStatusBadge}
                getStrategyLabel={getStrategyLabel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Pool Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Pool de Aquecimento</DialogTitle>
            <DialogDescription>
              Configure um novo pool para distribuir mensagens entre suas WABAs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pool-name">Nome do Pool</Label>
              <Input
                id="pool-name"
                placeholder="Ex: Aquecimento Principal"
                value={newPoolName}
                onChange={(e) => setNewPoolName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pool-strategy">Estrategia de Rotacao</Label>
              <Select value={newPoolStrategy} onValueChange={setNewPoolStrategy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="least_used">Menor Uso (Recomendado)</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="quality_first">Qualidade Primeiro</SelectItem>
                  <SelectItem value="weighted">Por Peso/Prioridade</SelectItem>
                  <SelectItem value="random">Aleatorio</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define como as WABAs serao selecionadas para envio
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePool} disabled={createPool.isPending || !newPoolName.trim()}>
              {createPool.isPending ? 'Criando...' : 'Criar Pool'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!poolToDelete} onOpenChange={() => setPoolToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pool de aquecimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao nao pode ser desfeita. O pool e todos os seus dados serao removidos
              permanentemente, incluindo historico de contatos e configuracoes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// Pool Card Component
interface PoolCardProps {
  pool: WarmingPool;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  getStatusBadge: (status: string | null) => React.ReactNode;
  getStrategyLabel: (strategy: string | null) => string;
}

function PoolCard({
  pool,
  onPause,
  onResume,
  onDelete,
  getStatusBadge,
  getStrategyLabel,
}: PoolCardProps) {
  const { data: members = [] } = useWarmingPoolMembers(pool.id);

  const activeMembers = members.filter((m) => m.status === 'active').length;
  const pausedMembers = members.filter((m) => m.status === 'paused').length;
  const totalLimit = members.reduce((acc, m) => acc + (m.current_daily_limit || 0), 0);
  const totalSent = members.reduce((acc, m) => acc + (m.messages_sent_today || 0), 0);
  const progressPercent = totalLimit > 0 ? (totalSent / totalLimit) * 100 : 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                pool.status === 'active' ? 'bg-orange-500/10' : 'bg-muted'
              }`}
            >
              <Flame
                className={`h-6 w-6 ${
                  pool.status === 'active' ? 'text-orange-500' : 'text-muted-foreground'
                }`}
              />
            </div>
            <div>
              <Link to={`/warming/${pool.id}`} className="font-semibold hover:underline">
                {pool.name}
              </Link>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Estrategia: {getStrategyLabel(pool.rotation_strategy)}</span>
                {pool.warmup_enabled && (
                  <>
                    <span>|</span>
                    <span>Rampa: {pool.warmup_days} dias</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(pool.status)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/warming/${pool.id}`}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {pool.status === 'active' ? (
                  <DropdownMenuItem onClick={onPause}>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onResume}>
                    <Play className="h-4 w-4 mr-2" />
                    Retomar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* WABAs Summary */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          {[
            { label: 'WABAs', value: members.length, icon: Users },
            { label: 'Ativas', value: activeMembers, icon: CheckCircle2, color: 'text-green-500' },
            { label: 'Pausadas', value: pausedMembers, icon: Pause, color: 'text-yellow-500' },
            { label: 'Hoje', value: totalSent.toLocaleString(), icon: MessageSquare },
            { label: 'Limite', value: totalLimit.toLocaleString(), icon: Zap },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <p className={`text-lg font-semibold ${stat.color || ''}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Progress */}
        {totalLimit > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso Diario</span>
              <span className="font-medium">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Quality Alerts */}
        {members.some((m) => m.current_quality === 'YELLOW' || m.current_quality === 'RED') && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">
              {members.filter((m) => m.current_quality === 'RED').length > 0
                ? `${members.filter((m) => m.current_quality === 'RED').length} WABA(s) com qualidade RED`
                : `${members.filter((m) => m.current_quality === 'YELLOW').length} WABA(s) com qualidade YELLOW`}
            </span>
          </div>
        )}

        {/* Time Window */}
        {pool.time_window_enabled && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Janela de envio: {pool.time_window_start} - {pool.time_window_end} ({pool.timezone})
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

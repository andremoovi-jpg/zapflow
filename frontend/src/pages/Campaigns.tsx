import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Calendar, MoreHorizontal, Send, Clock, CheckCircle2, Copy, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  useCampaigns, 
  useCampaignStats,
  useUpdateCampaign,
  useDuplicateCampaign,
  useDeleteCampaign
} from '@/hooks/useCampaigns';

export default function Campaigns() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useCampaigns({ 
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: searchQuery 
  });
  const { data: stats } = useCampaignStats();
  const updateCampaign = useUpdateCampaign();
  const duplicateCampaign = useDuplicateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'running' ? 'paused' : 'running';
    updateCampaign.mutate({ id, status: newStatus });
  };

  const handleDuplicate = (id: string) => {
    duplicateCampaign.mutate(id);
  };

  const handleDelete = () => {
    if (campaignToDelete) {
      deleteCampaign.mutate(campaignToDelete);
      setCampaignToDelete(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Send className="h-6 w-6 text-success animate-pulse" />;
      case 'scheduled':
        return <Clock className="h-6 w-6 text-warning" />;
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-muted-foreground" />;
      case 'paused':
        return <Clock className="h-6 w-6 text-orange-500" />;
      default:
        return <Send className="h-6 w-6 text-primary" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      running: { class: 'badge-success', label: 'Em andamento' },
      scheduled: { class: 'badge-warning', label: 'Agendada' },
      completed: { class: 'bg-muted text-muted-foreground', label: 'Concluída' },
      paused: { class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'Pausada' },
      cancelled: { class: 'bg-destructive/10 text-destructive', label: 'Cancelada' },
      draft: { class: 'bg-primary/10 text-primary', label: 'Rascunho' },
      pending: { class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Pendente' },
    };
    const config = badges[status] || badges.draft;
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${config.class}`}>
        {config.label}
      </span>
    );
  };

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Campanhas' }]}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Campanhas</h1>
            <p className="text-muted-foreground">
              Gerencie suas campanhas de disparo em massa
            </p>
          </div>
          <Button asChild>
            <Link to="/campaigns/new">
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Link>
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Campanhas Ativas', value: stats?.active || 0, icon: Send, color: 'text-primary' },
            { label: 'Mensagens Enviadas', value: stats?.totalSent?.toLocaleString() || '0', icon: CheckCircle2, color: 'text-success' },
            { label: 'Taxa de Entrega', value: `${stats?.deliveryRate || 0}%`, icon: CheckCircle2, color: 'text-info' },
            { label: 'Agendadas', value: stats?.scheduled || 0, icon: Calendar, color: 'text-warning' },
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
              placeholder="Buscar campanhas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button 
            variant={statusFilter === 'all' ? 'outline' : 'ghost'} 
            onClick={() => setStatusFilter('all')}
          >
            Todas
          </Button>
          <Button 
            variant={statusFilter === 'running' ? 'outline' : 'ghost'}
            onClick={() => setStatusFilter('running')}
          >
            Em andamento
          </Button>
          <Button 
            variant={statusFilter === 'scheduled' ? 'outline' : 'ghost'}
            onClick={() => setStatusFilter('scheduled')}
          >
            Agendadas
          </Button>
          <Button 
            variant={statusFilter === 'completed' ? 'outline' : 'ghost'}
            onClick={() => setStatusFilter('completed')}
          >
            Concluídas
          </Button>
        </div>

        {/* Campaigns List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Send className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhuma campanha encontrada</p>
              <p className="text-muted-foreground mb-4">Crie sua primeira campanha para começar</p>
              <Button asChild>
                <Link to="/campaigns/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Campanha
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        campaign.status === 'running' ? 'bg-success/10' :
                        campaign.status === 'scheduled' ? 'bg-warning/10' :
                        campaign.status === 'completed' ? 'bg-muted' : 'bg-primary/10'
                      }`}>
                        {getStatusIcon(campaign.status)}
                      </div>
                      <div>
                        <Link 
                          to={`/campaigns/${campaign.id}`}
                          className="font-semibold hover:underline"
                        >
                          {campaign.name}
                        </Link>
                        {campaign.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {campaign.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(campaign.status)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/campaigns/${campaign.id}`}>Ver detalhes</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(campaign.id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          {campaign.status === 'running' && (
                            <DropdownMenuItem onClick={() => handleToggleStatus(campaign.id, campaign.status)}>
                              Pausar
                            </DropdownMenuItem>
                          )}
                          {campaign.status === 'paused' && (
                            <DropdownMenuItem onClick={() => handleToggleStatus(campaign.id, campaign.status)}>
                              Retomar
                            </DropdownMenuItem>
                          )}
                          {campaign.status === 'draft' && (
                            <DropdownMenuItem onClick={() => updateCampaign.mutate({ id: campaign.id, status: 'pending' })}>
                              Iniciar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => setCampaignToDelete(campaign.id)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {campaign.scheduled_at && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Agendada para: {format(new Date(campaign.scheduled_at), "PPP 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-5 gap-4 mb-4">
                    {[
                      { label: 'Total', value: campaign.stats?.total || 0 },
                      { label: 'Enviadas', value: campaign.stats?.sent || 0 },
                      { label: 'Entregues', value: campaign.stats?.delivered || 0 },
                      { label: 'Lidas', value: campaign.stats?.read || 0 },
                      { label: 'Falhas', value: campaign.stats?.failed || 0, error: true },
                    ].map((stat, index) => (
                      <div key={index} className="text-center">
                        <p className={`text-lg font-semibold ${stat.error && stat.value > 0 ? 'text-destructive' : ''}`}>
                          {(stat.value || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {(campaign.stats?.total || 0) > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">
                          {Math.round(((campaign.stats?.sent || 0) / (campaign.stats?.total || 1)) * 100)}%
                        </span>
                      </div>
                      <Progress
                        value={((campaign.stats?.sent || 0) / (campaign.stats?.total || 1)) * 100}
                        className="h-2"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!campaignToDelete} onOpenChange={() => setCampaignToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha e todos os seus dados serão removidos permanentemente.
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

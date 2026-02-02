import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, GitBranch, Zap, Trash2, Copy, Edit } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateFlowModal } from '@/components/flows/CreateFlowModal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyFlows } from '@/components/ui/empty-state';
import { useFlows, useToggleFlowActive, useDeleteFlow, useDuplicateFlow } from '@/hooks/useFlows';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type FlowFilter = 'all' | 'active' | 'paused' | 'draft';

export default function Flows() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FlowFilter>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState<string | null>(null);

  const { data: flows, isLoading } = useFlows(filter, search);
  const toggleActive = useToggleFlowActive();
  const deleteFlow = useDeleteFlow();
  const duplicateFlow = useDuplicateFlow();

  const handleToggle = (flowId: string, currentState: boolean) => {
    if (currentState) {
      setDeactivateConfirm(flowId);
    } else {
      toggleActive.mutate({ flowId, isActive: true });
    }
  };

  const confirmDeactivate = () => {
    if (deactivateConfirm) {
      toggleActive.mutate({ flowId: deactivateConfirm, isActive: false });
      setDeactivateConfirm(null);
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteFlow.mutate(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const handleDuplicate = (flowId: string) => {
    duplicateFlow.mutate(flowId);
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (isActive) return 'badge-success';
    if (status === 'paused') return 'badge-warning';
    return 'bg-muted text-muted-foreground';
  };

  const getStatusLabel = (status: string, isActive: boolean) => {
    if (isActive) return 'Ativo';
    if (status === 'paused') return 'Pausado';
    return 'Rascunho';
  };

  const hasFlows = flows && flows.length > 0;

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Fluxos' }]}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fluxos de Automação</h1>
            <p className="text-muted-foreground">
              Crie e gerencie seus fluxos de automação
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Fluxo
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fluxos..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant={filter === 'all' ? 'outline' : 'ghost'} onClick={() => setFilter('all')}>Todos</Button>
          <Button variant={filter === 'active' ? 'outline' : 'ghost'} onClick={() => setFilter('active')}>Ativos</Button>
          <Button variant={filter === 'paused' ? 'outline' : 'ghost'} onClick={() => setFilter('paused')}>Pausados</Button>
          <Button variant={filter === 'draft' ? 'outline' : 'ghost'} onClick={() => setFilter('draft')}>Rascunhos</Button>
        </div>

        {/* Flows Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-10 w-10 rounded-lg mb-4" />
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))
          ) : !hasFlows && !search ? (
            <div className="col-span-full">
              <EmptyFlows onCreate={() => setCreateOpen(true)} />
            </div>
          ) : (
            flows?.map((flow) => (
              <Card key={flow.id} className="hover-lift cursor-pointer" onClick={() => navigate(`/flows/${flow.id}/edit`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <GitBranch className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch 
                        checked={flow.is_active} 
                        onCheckedChange={() => handleToggle(flow.id, flow.is_active)}
                        disabled={flow.status === 'draft'}
                        aria-label={flow.is_active ? 'Desativar fluxo' : 'Ativar fluxo'}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais opções">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => navigate(`/flows/${flow.id}/edit`)}>
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(flow.id)}><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(flow.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <h3 className="font-semibold mb-1">{flow.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {flow.description || 'Sem descrição'}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <Zap className="h-3 w-3" />
                    <span>{flow.trigger_type.replace('_', ' ')}</span>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <p className="text-lg font-semibold">{(flow.total_executions || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">execuções</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(flow.status, flow.is_active)}`}>
                        {getStatusLabel(flow.status, flow.is_active)}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {flow.last_execution_at 
                          ? formatDistanceToNow(new Date(flow.last_execution_at), { addSuffix: true, locale: ptBR })
                          : 'Nunca executado'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {/* Create New Flow Card */}
          <Card className="border-dashed hover-lift cursor-pointer" onClick={() => setCreateOpen(true)}>
            <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[200px] text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Criar Novo Fluxo</h3>
              <p className="text-sm text-muted-foreground">
                Comece do zero ou use um template
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateFlowModal open={createOpen} onOpenChange={setCreateOpen} />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Excluir fluxo"
        description="Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
        loading={deleteFlow.isPending}
      />

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={!!deactivateConfirm}
        onOpenChange={(open) => !open && setDeactivateConfirm(null)}
        title="Desativar fluxo"
        description="O fluxo será pausado e não processará novas conversas. Deseja continuar?"
        confirmLabel="Desativar"
        onConfirm={confirmDeactivate}
        loading={toggleActive.isPending}
      />
    </DashboardLayout>
  );
}

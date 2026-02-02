import { useState } from 'react';
import { RefreshCw, Search, MoreHorizontal, FileText, CheckCircle2, Clock, XCircle, Eye } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTemplates, useSyncTemplates, type Template } from '@/hooks/useTemplates';
import { TemplateDetailModal } from '@/components/templates/TemplateDetailModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Templates() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data: templates = [], isLoading } = useTemplates({ 
    status: statusFilter,
    search: search || undefined,
  });
  
  const syncMutation = useSyncTemplates();

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'APPROVED':
        return 'Aprovado';
      case 'PENDING':
        return 'Pendente';
      case 'REJECTED':
        return 'Rejeitado';
      default:
        return status || 'N/A';
    }
  };

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case 'MARKETING':
        return 'Marketing';
      case 'UTILITY':
        return 'Utilidade';
      case 'AUTHENTICATION':
        return 'Autenticação';
      default:
        return category || 'N/A';
    }
  };

  const getBodyText = (template: Template): string => {
    const bodyComponent = template.components.find(c => c.type === 'BODY');
    return bodyComponent?.text || '';
  };

  const getHeaderText = (template: Template): string | null => {
    const headerComponent = template.components.find(c => c.type === 'HEADER');
    return headerComponent?.text || null;
  };

  const handleViewDetails = (template: Template) => {
    setSelectedTemplate(template);
    setDetailModalOpen(true);
  };

  const filterTemplates = (templates: Template[], status: string) => {
    if (status === 'all') return templates;
    return templates.filter(t => t.status === status.toUpperCase());
  };

  const renderTemplateCard = (template: Template) => (
    <Card key={template.id} className="hover-lift">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewDetails(template)}>
                <Eye className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem>Usar em campanha</DropdownMenuItem>
              <DropdownMenuItem>Duplicar</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="font-semibold mb-1 truncate">{template.name}</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {template.language} • {template.synced_at 
            ? format(new Date(template.synced_at), "dd/MM/yyyy", { locale: ptBR })
            : 'Nunca sincronizado'
          }
        </p>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="px-2 py-0.5 text-xs bg-muted rounded-full">
            {getCategoryLabel(template.category)}
          </span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${
            template.status === 'APPROVED' ? 'badge-success' :
            template.status === 'PENDING' ? 'badge-warning' :
            'bg-destructive/10 text-destructive border border-destructive/20'
          }`}>
            {getStatusIcon(template.status)}
            {getStatusLabel(template.status)}
          </span>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          {getHeaderText(template) && (
            <p className="font-medium mb-1 truncate">{getHeaderText(template)}</p>
          )}
          <p className="text-muted-foreground line-clamp-3">{getBodyText(template)}</p>
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-3"
          onClick={() => handleViewDetails(template)}
        >
          <Eye className="h-4 w-4 mr-2" />
          Ver Detalhes
        </Button>
      </CardContent>
    </Card>
  );

  const renderLoadingSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <Skeleton className="w-8 h-8 rounded" />
            </div>
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2 mb-3" />
            <div className="flex gap-2 mb-4">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-20 rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-12">
      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">Nenhum template encontrado</h3>
      <p className="text-muted-foreground mb-4">
        {search 
          ? 'Nenhum template corresponde à sua busca.'
          : 'Sincronize seus templates da Meta para começar.'
        }
      </p>
      {!search && (
        <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Sincronizar Templates
        </Button>
      )}
    </div>
  );

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Templates' }]}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Templates</h1>
            <p className="text-muted-foreground">
              Gerencie seus templates de mensagem aprovados pela Meta
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="approved">Aprovados</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
            </TabsList>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value="all" className="mt-6">
            {isLoading ? renderLoadingSkeleton() : (
              templates.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map(renderTemplateCard)}
                </div>
              ) : renderEmptyState()
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-6">
            {isLoading ? renderLoadingSkeleton() : (
              filterTemplates(templates, 'approved').length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterTemplates(templates, 'approved').map(renderTemplateCard)}
                </div>
              ) : renderEmptyState()
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            {isLoading ? renderLoadingSkeleton() : (
              filterTemplates(templates, 'pending').length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterTemplates(templates, 'pending').map(renderTemplateCard)}
                </div>
              ) : renderEmptyState()
            )}
          </TabsContent>

          <TabsContent value="rejected" className="mt-6">
            {isLoading ? renderLoadingSkeleton() : (
              filterTemplates(templates, 'rejected').length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterTemplates(templates, 'rejected').map(renderTemplateCard)}
                </div>
              ) : renderEmptyState()
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Template Detail Modal */}
      <TemplateDetailModal
        template={selectedTemplate}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </DashboardLayout>
  );
}

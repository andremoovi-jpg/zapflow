import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Flame,
  Plus,
  Trash2,
  Pause,
  Play,
  Settings,
  Users,
  History,
  AlertTriangle,
  Clock,
  MoreHorizontal,
  Loader2,
  MessageSquare,
  Copy,
  ChevronDown,
  ChevronUp,
  Mail,
  Edit2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Send,
  Eye,
  MousePointerClick,
  Link2,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react';
import { useWarmingAnalytics, useWarmingFunnel } from '@/hooks/useAnalytics';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  useWarmingPool,
  useUpdateWarmingPool,
  useWarmingPoolMembers,
  useAddWarmingPoolMember,
  useRemoveWarmingPoolMember,
  usePauseWarmingPoolMember,
  useResumeWarmingPoolMember,
  useWarmingEventsLog,
  useWarmingMemberMessages,
  useAddWarmingMemberMessage,
  useUpdateWarmingMemberMessage,
  useRemoveWarmingMemberMessage,
  useDuplicateWarmingMemberMessages,
  type WarmingMemberMessage,
} from '@/hooks/useWarmingPools';
import { useWhatsAppAccounts } from '@/hooks/useWhatsAppAccounts';
import { useAllOrganizationTemplates, type Template, getComponent } from '@/hooks/useTemplates';
import { useCustomFields } from '@/hooks/useCustomFields';
import { ButtonActionsConfig, type FlowAction, type ButtonActionsMap } from '@/components/campaigns/ButtonActionsConfig';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Sub-component para mostrar mensagens de cada WABA
interface MemberMessagesCardProps {
  member: {
    id: string;
    whatsapp_account_id: string;
    waba_name: string;
    status: string | null;
    current_quality: string | null;
  };
  poolId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onAddMessage: () => void;
  onRemoveMessage: (msgId: string) => void;
  templates: Template[];
}

function MemberMessagesCard({
  member,
  poolId,
  isExpanded,
  onToggle,
  onAddMessage,
  onRemoveMessage,
  templates,
}: MemberMessagesCardProps) {
  const { data: messages = [], isLoading } = useWarmingMemberMessages(member.id);

  const getQualityColor = (quality: string | null) => {
    if (quality === 'GREEN') return 'text-green-500';
    if (quality === 'YELLOW') return 'text-yellow-500';
    if (quality === 'RED') return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{member.waba_name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <span className={getQualityColor(member.current_quality)}>
                      {member.current_quality || 'GREEN'}
                    </span>
                    <span>|</span>
                    <span>{messages.length} mensagens</span>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                  {member.status}
                </Badge>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="py-4 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center border rounded-lg border-dashed">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  Nenhuma mensagem configurada
                </p>
                <Button size="sm" onClick={onAddMessage}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Mensagem
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Timeline de mensagens */}
                <div className="relative">
                  {messages.map((msg, index) => (
                    <div key={msg.id} className="flex gap-3 pb-4 last:pb-0">
                      {/* Linha do tempo */}
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                          {index + 1}
                        </div>
                        {index < messages.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-2" />
                        )}
                      </div>

                      {/* Conteudo */}
                      <div className="flex-1 bg-muted/50 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{msg.template_name}</p>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {msg.delay_days === 0 &&
                              msg.delay_hours === 0 &&
                              msg.delay_minutes === 0
                                ? 'Imediato'
                                : `Apos ${msg.delay_days || 0}d ${msg.delay_hours || 0}h`}
                              {msg.only_if_no_reply && (
                                <>
                                  <span>|</span>
                                  <span>Se nao respondeu</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemoveMessage(msg.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botao para adicionar */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onAddMessage}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Mensagem
                </Button>

                {templates.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    Esta WABA nao tem templates aprovados
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function WarmingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: pool, isLoading: loadingPool } = useWarmingPool(id);
  const { data: members = [], isLoading: loadingMembers } = useWarmingPoolMembers(id);
  const { data: events = [] } = useWarmingEventsLog(id, 50);
  const { data: allWabas = [] } = useWhatsAppAccounts();

  // Buscar templates de todas as WABAs do pool
  const memberWabaIds = members.map(m => m.whatsapp_account_id);
  const { data: templates = [] } = useAllOrganizationTemplates(memberWabaIds.length > 0 ? memberWabaIds : undefined);
  const { fields: customFields = [] } = useCustomFields();

  const updatePool = useUpdateWarmingPool();
  const addMember = useAddWarmingPoolMember();
  const removeMember = useRemoveWarmingPoolMember();
  const pauseMember = usePauseWarmingPoolMember();
  const resumeMember = useResumeWarmingPoolMember();
  const addMessage = useAddWarmingMemberMessage();
  const updateMessage = useUpdateWarmingMemberMessage();
  const removeMessage = useRemoveWarmingMemberMessage();
  const duplicateMessages = useDuplicateWarmingMemberMessages();

  const [showAddWabaModal, setShowAddWabaModal] = useState(false);
  const [selectedWaba, setSelectedWaba] = useState('');
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    wabaId: string;
    name: string;
  } | null>(null);

  // Estado para aba de mensagens
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showAddMessageModal, setShowAddMessageModal] = useState(false);
  const [selectedMemberForMessage, setSelectedMemberForMessage] = useState<{
    id: string;
    wabaId: string;
    wabaName: string;
  } | null>(null);
  const [newMessageTemplate, setNewMessageTemplate] = useState('');
  const [newMessageDelayDays, setNewMessageDelayDays] = useState(0);
  const [newMessageDelayHours, setNewMessageDelayHours] = useState(0);
  const [newMessageOnlyIfNoReply, setNewMessageOnlyIfNoReply] = useState(true);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [buttonActions, setButtonActions] = useState<ButtonActionsMap>({});
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFromMember, setCopyFromMember] = useState<string | null>(null);
  const [copyToMember, setCopyToMember] = useState<string>('');

  if (loadingPool) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Aquecimento', href: '/warming' }, { label: 'Carregando...' }]}>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48" />
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!pool) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Aquecimento', href: '/warming' }, { label: 'Nao encontrado' }]}>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium">Pool nao encontrado</p>
            <Button className="mt-4" onClick={() => navigate('/warming')}>
              Voltar
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // WABAs disponiveis (que ainda nao estao no pool)
  const availableWabas = allWabas.filter(
    (waba) => !members.some((m) => m.whatsapp_account_id === waba.id)
  );

  // Templates filtrados por WABA selecionada
  const getTemplatesForWaba = (wabaId: string) => {
    return templates.filter((t) => t.whatsapp_account_id === wabaId && t.status === 'APPROVED');
  };

  // Helper para extrair variaveis do template
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    return matches ? [...new Set(matches.map(m => m.replace(/[{}]/g, '')))] : [];
  };

  // Helper para obter texto do body do template
  const getBodyText = (template: Template): string => {
    const bodyComponent = getComponent(template.components, 'BODY');
    return bodyComponent?.text || '';
  };

  // Helper para extrair botoes QUICK_REPLY do template
  const getTemplateButtons = (template: Template): Array<{ type: string; text: string }> => {
    const buttonsComponent = getComponent(template.components, 'BUTTONS');
    return (buttonsComponent?.buttons || []).filter(btn => btn.type === 'QUICK_REPLY');
  };

  // Template selecionado atualmente
  const selectedTemplateData = templates.find(t => t.id === newMessageTemplate);

  const handleAddWaba = async () => {
    if (!selectedWaba || !id) return;
    await addMember.mutateAsync({ poolId: id, wabaId: selectedWaba });
    setSelectedWaba('');
    setShowAddWabaModal(false);
  };

  const handleRemoveMember = () => {
    if (!memberToRemove || !id) return;
    removeMember.mutate({
      id: memberToRemove.id,
      poolId: id,
      wabaId: memberToRemove.wabaId,
    });
    setMemberToRemove(null);
  };

  const handleAddMessage = async () => {
    if (!selectedMemberForMessage || !newMessageTemplate || !id) return;
    const template = templates.find((t) => t.id === newMessageTemplate);
    if (!template) return;

    // Formatar variaveis para o formato esperado pelo backend
    const formattedVariables: Record<string, any> = {};
    if (Object.keys(templateVariables).length > 0) {
      // Body variables como array
      formattedVariables.body = Object.keys(templateVariables)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(key => templateVariables[key]);
    }

    // Filtrar button_actions vazias
    const validButtonActions = Object.fromEntries(
      Object.entries(buttonActions).filter(([_, actions]) => actions.length > 0)
    );

    await addMessage.mutateAsync({
      memberId: selectedMemberForMessage.id,
      poolId: id,
      templateId: template.id,
      templateName: template.name,
      templateLanguage: template.language || 'pt_BR',
      templateVariables: formattedVariables,
      delayDays: newMessageDelayDays,
      delayHours: newMessageDelayHours,
      onlyIfNoReply: newMessageOnlyIfNoReply,
      buttonActions: Object.keys(validButtonActions).length > 0 ? validButtonActions : undefined,
    });

    setNewMessageTemplate('');
    setNewMessageDelayDays(0);
    setNewMessageDelayHours(0);
    setNewMessageOnlyIfNoReply(true);
    setTemplateVariables({});
    setButtonActions({});
    setShowAddMessageModal(false);
    setSelectedMemberForMessage(null);
  };

  const handleCopyMessages = async () => {
    if (!copyFromMember || !copyToMember || !id) return;

    await duplicateMessages.mutateAsync({
      fromMemberId: copyFromMember,
      toMemberId: copyToMember,
      poolId: id,
    });

    setShowCopyModal(false);
    setCopyFromMember(null);
    setCopyToMember('');
  };

  const openAddMessageModal = (member: { id: string; whatsapp_account_id: string; waba_name: string }) => {
    setSelectedMemberForMessage({
      id: member.id,
      wabaId: member.whatsapp_account_id,
      wabaName: member.waba_name,
    });
    setShowAddMessageModal(true);
  };

  const getQualityBadge = (quality: string | null) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
      GREEN: { variant: 'default', label: 'GREEN' },
      YELLOW: { variant: 'secondary', label: 'YELLOW' },
      RED: { variant: 'destructive', label: 'RED' },
    };
    const { variant, label } = config[quality || 'GREEN'] || config.GREEN;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('paused')) return <Pause className="h-4 w-4 text-yellow-500" />;
    if (eventType.includes('resumed')) return <Play className="h-4 w-4 text-green-500" />;
    if (eventType.includes('added')) return <Plus className="h-4 w-4 text-blue-500" />;
    if (eventType.includes('removed')) return <Trash2 className="h-4 w-4 text-red-500" />;
    if (eventType.includes('quality')) return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Aquecimento', href: '/warming' },
        { label: pool.name },
      ]}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/warming')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
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
                <h1 className="text-2xl font-bold">{pool.name}</h1>
                <p className="text-muted-foreground">
                  {members.length} WABAs | {pool.rotation_strategy}
                </p>
              </div>
            </div>
          </div>
          <Badge variant={pool.status === 'active' ? 'default' : 'secondary'}>
            {pool.status === 'active' ? 'Ativo' : 'Pausado'}
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="wabas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="wabas" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              WABAs ({members.length})
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Mensagens
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuracoes
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* WABAs Tab */}
          <TabsContent value="wabas" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground">
                WABAs que fazem parte deste pool de aquecimento
              </p>
              <Button onClick={() => setShowAddWabaModal(true)} disabled={availableWabas.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar WABA
              </Button>
            </div>

            {loadingMembers ? (
              <Skeleton className="h-64" />
            ) : members.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">Nenhuma WABA no pool</p>
                  <p className="text-muted-foreground mb-4">
                    Adicione WABAs para comecar o aquecimento
                  </p>
                  <Button onClick={() => setShowAddWabaModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar WABA
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>WABA</TableHead>
                      <TableHead>Qualidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dia</TableHead>
                      <TableHead>Hoje</TableHead>
                      <TableHead>Limite</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const progress =
                        (member.current_daily_limit || 0) > 0
                          ? ((member.messages_sent_today || 0) / (member.current_daily_limit || 1)) * 100
                          : 0;

                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.waba_name}</TableCell>
                          <TableCell>{getQualityBadge(member.current_quality)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={member.status === 'active' ? 'default' : 'secondary'}
                            >
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{member.warmup_phase_day || 1}</TableCell>
                          <TableCell>{member.messages_sent_today || 0}</TableCell>
                          <TableCell>{member.current_daily_limit || '-'}</TableCell>
                          <TableCell className="w-32">
                            <Progress value={progress} className="h-2" />
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {member.status === 'active' ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      pauseMember.mutate({
                                        id: member.id,
                                        poolId: id!,
                                        wabaId: member.whatsapp_account_id,
                                        reason: 'manual',
                                      })
                                    }
                                  >
                                    <Pause className="h-4 w-4 mr-2" />
                                    Pausar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      resumeMember.mutate({
                                        id: member.id,
                                        poolId: id!,
                                        wabaId: member.whatsapp_account_id,
                                      })
                                    }
                                  >
                                    <Play className="h-4 w-4 mr-2" />
                                    Retomar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() =>
                                    setMemberToRemove({
                                      id: member.id,
                                      wabaId: member.whatsapp_account_id,
                                      name: member.waba_name,
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Messages Tab - Fluxo por WABA */}
          <TabsContent value="messages" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-muted-foreground">
                  Configure o fluxo de mensagens para cada WABA
                </p>
                <p className="text-xs text-muted-foreground">
                  Cada WABA usa seus proprios templates
                </p>
              </div>
              {members.length > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setShowCopyModal(true)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Fluxo
                </Button>
              )}
            </div>

            {members.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">Nenhuma WABA no pool</p>
                  <p className="text-muted-foreground mb-4">
                    Adicione WABAs primeiro para configurar mensagens
                  </p>
                  <Button onClick={() => setShowAddWabaModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar WABA
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <MemberMessagesCard
                    key={member.id}
                    member={member}
                    poolId={id!}
                    isExpanded={expandedMember === member.id}
                    onToggle={() =>
                      setExpandedMember(expandedMember === member.id ? null : member.id)
                    }
                    onAddMessage={() => openAddMessageModal(member)}
                    onRemoveMessage={(msgId) =>
                      removeMessage.mutate({
                        id: msgId,
                        memberId: member.id,
                        poolId: id!,
                      })
                    }
                    templates={getTemplatesForWaba(member.whatsapp_account_id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* General Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Configuracoes Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Estrategia de Rotacao</Label>
                    <Select
                      value={pool.rotation_strategy || 'least_used'}
                      onValueChange={(value) =>
                        updatePool.mutate({ id: pool.id, rotation_strategy: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="least_used">Menor Uso</SelectItem>
                        <SelectItem value="round_robin">Round Robin</SelectItem>
                        <SelectItem value="quality_first">Qualidade Primeiro</SelectItem>
                        <SelectItem value="weighted">Por Peso</SelectItem>
                        <SelectItem value="random">Aleatorio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Limite Diario por WABA</Label>
                    <Input
                      type="number"
                      value={pool.daily_limit_per_waba || 100}
                      onChange={(e) =>
                        updatePool.mutate({
                          id: pool.id,
                          daily_limit_per_waba: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Pausar em Qualidade</Label>
                    <Select
                      value={pool.pause_on_quality || 'RED'}
                      onValueChange={(value) =>
                        updatePool.mutate({ id: pool.id, pause_on_quality: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RED">Apenas RED</SelectItem>
                        <SelectItem value="YELLOW">YELLOW ou RED</SelectItem>
                        <SelectItem value="OFF">Desabilitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Warmup Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Rampa de Aquecimento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Rampa Habilitada</p>
                      <p className="text-sm text-muted-foreground">
                        Aumentar volume gradualmente
                      </p>
                    </div>
                    <Switch
                      checked={pool.warmup_enabled || false}
                      onCheckedChange={(checked) =>
                        updatePool.mutate({ id: pool.id, warmup_enabled: checked })
                      }
                    />
                  </div>

                  {pool.warmup_enabled && (
                    <>
                      <div className="space-y-2">
                        <Label>Duracao (dias): {pool.warmup_days || 14}</Label>
                        <Slider
                          value={[pool.warmup_days || 14]}
                          min={7}
                          max={30}
                          step={1}
                          onValueChange={([value]) =>
                            updatePool.mutate({ id: pool.id, warmup_days: value })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Volume Inicial</Label>
                          <Input
                            type="number"
                            value={pool.warmup_start_volume || 10}
                            onChange={(e) =>
                              updatePool.mutate({
                                id: pool.id,
                                warmup_start_volume: parseInt(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Volume Final</Label>
                          <Input
                            type="number"
                            value={pool.warmup_end_volume || 200}
                            onChange={(e) =>
                              updatePool.mutate({
                                id: pool.id,
                                warmup_end_volume: parseInt(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Time Window */}
              <Card>
                <CardHeader>
                  <CardTitle>Janela de Tempo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Janela Habilitada</p>
                      <p className="text-sm text-muted-foreground">
                        Limitar horario de envio
                      </p>
                    </div>
                    <Switch
                      checked={pool.time_window_enabled || false}
                      onCheckedChange={(checked) =>
                        updatePool.mutate({ id: pool.id, time_window_enabled: checked })
                      }
                    />
                  </div>

                  {pool.time_window_enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Inicio</Label>
                        <Input
                          type="time"
                          value={pool.time_window_start || '08:00'}
                          onChange={(e) =>
                            updatePool.mutate({
                              id: pool.id,
                              time_window_start: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fim</Label>
                        <Input
                          type="time"
                          value={pool.time_window_end || '20:00'}
                          onChange={(e) =>
                            updatePool.mutate({
                              id: pool.id,
                              time_window_end: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Dias da Semana */}
                  <div className="space-y-3 pt-2 border-t">
                    <div>
                      <p className="font-medium">Dias Permitidos</p>
                      <p className="text-sm text-muted-foreground">
                        Selecione os dias em que o envio esta liberado
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { day: 0, label: 'Dom' },
                        { day: 1, label: 'Seg' },
                        { day: 2, label: 'Ter' },
                        { day: 3, label: 'Qua' },
                        { day: 4, label: 'Qui' },
                        { day: 5, label: 'Sex' },
                        { day: 6, label: 'Sab' },
                      ].map(({ day, label }) => {
                        const allowedDays = (pool.allowed_days as number[]) || [0, 1, 2, 3, 4, 5, 6];
                        const isChecked = allowedDays.includes(day);
                        return (
                          <div key={day} className="flex items-center space-x-2">
                            <Checkbox
                              id={`day-${day}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const newDays = checked
                                  ? [...allowedDays, day].sort((a, b) => a - b)
                                  : allowedDays.filter((d) => d !== day);
                                updatePool.mutate({
                                  id: pool.id,
                                  allowed_days: newDays,
                                });
                              }}
                            />
                            <Label
                              htmlFor={`day-${day}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {label}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Safety Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Seguranca</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Max Falhas Consecutivas</Label>
                    <Input
                      type="number"
                      value={pool.emergency_stop_failures || 10}
                      onChange={(e) =>
                        updatePool.mutate({
                          id: pool.id,
                          emergency_stop_failures: parseInt(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Pausar pool se atingir este numero de falhas
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto Retomar</p>
                      <p className="text-sm text-muted-foreground">
                        Retomar automaticamente WABAs pausadas
                      </p>
                    </div>
                    <Switch
                      checked={pool.auto_resume || false}
                      onCheckedChange={(checked) =>
                        updatePool.mutate({ id: pool.id, auto_resume: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Eventos Recentes</CardTitle>
                <CardDescription>Ultimos 50 eventos do pool</CardDescription>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum evento registrado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        {getEventIcon(event.event_type)}
                        <div className="flex-1">
                          <p className="font-medium">{event.event_type.replace(/_/g, ' ')}</p>
                          {event.event_data && (
                            <p className="text-sm text-muted-foreground">
                              {JSON.stringify(event.event_data)}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {event.created_at &&
                            format(new Date(event.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <WarmingAnalyticsTab poolId={id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add WABA Modal */}
      <Dialog open={showAddWabaModal} onOpenChange={setShowAddWabaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar WABA ao Pool</DialogTitle>
            <DialogDescription>
              Selecione uma WABA para adicionar ao aquecimento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>WABA</Label>
              <Select value={selectedWaba} onValueChange={setSelectedWaba}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma WABA" />
                </SelectTrigger>
                <SelectContent>
                  {availableWabas.map((waba) => (
                    <SelectItem key={waba.id} value={waba.id}>
                      {waba.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWabaModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddWaba} disabled={addMember.isPending || !selectedWaba}>
              {addMember.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Message Modal */}
      <Dialog open={showAddMessageModal} onOpenChange={(open) => {
        setShowAddMessageModal(open);
        if (!open) {
          setTemplateVariables({});
          setButtonActions({});
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Mensagem</DialogTitle>
            <DialogDescription>
              {selectedMemberForMessage?.wabaName} - Selecione um template aprovado
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={newMessageTemplate}
                onValueChange={(value) => {
                  setNewMessageTemplate(value);
                  // Inicializar variaveis do template selecionado
                  const template = templates.find(t => t.id === value);
                  if (template) {
                    const vars = extractVariables(getBodyText(template));
                    const initialVars: Record<string, string> = {};
                    vars.forEach(v => { initialVars[v] = ''; });
                    setTemplateVariables(initialVars);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {selectedMemberForMessage &&
                    getTemplatesForWaba(selectedMemberForMessage.wabaId).map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedMemberForMessage &&
                getTemplatesForWaba(selectedMemberForMessage.wabaId).length === 0 && (
                  <p className="text-sm text-destructive">
                    Nenhum template aprovado para esta WABA
                  </p>
                )}
            </div>

            {/* Configuracao de variaveis do template */}
            {selectedTemplateData && Object.keys(templateVariables).length > 0 && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <div>
                  <p className="font-medium text-sm">Preencher Variaveis</p>
                  <p className="text-xs text-muted-foreground">
                    Selecione um campo do contato ou digite um valor fixo
                  </p>
                </div>
                {Object.keys(templateVariables).map((key) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">Variavel {`{{${key}}}`}</Label>
                    <div className="flex gap-2">
                      <Select
                        value={templateVariables[key]?.startsWith('{{') ? templateVariables[key] : 'static'}
                        onValueChange={(value) => {
                          if (value === 'static') {
                            setTemplateVariables(prev => ({ ...prev, [key]: '' }));
                          } else {
                            setTemplateVariables(prev => ({ ...prev, [key]: value }));
                          }
                        }}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="static">Valor fixo</SelectItem>
                          <SelectItem value="{{nome}}">Nome do contato</SelectItem>
                          <SelectItem value="{{telefone}}">Telefone</SelectItem>
                          <SelectItem value="{{email}}">Email</SelectItem>
                          {customFields.map((field) => (
                            <SelectItem key={field.name} value={`{{${field.name}}}`}>
                              {field.label || field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!templateVariables[key]?.startsWith('{{') && (
                        <Input
                          value={templateVariables[key] || ''}
                          onChange={(e) => setTemplateVariables(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder="Digite o valor fixo"
                          className="flex-1"
                        />
                      )}
                      {templateVariables[key]?.startsWith('{{') && (
                        <div className="flex-1 flex items-center px-3 bg-primary/10 border border-primary/20 rounded-md text-sm">
                          <span className="text-primary font-medium">{templateVariables[key]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delay (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newMessageDelayDays}
                  onChange={(e) => setNewMessageDelayDays(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Delay (horas)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={newMessageDelayHours}
                  onChange={(e) => setNewMessageDelayHours(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Apenas se nao respondeu</p>
                <p className="text-xs text-muted-foreground">
                  Pular se o contato ja tiver respondido
                </p>
              </div>
              <Switch
                checked={newMessageOnlyIfNoReply}
                onCheckedChange={setNewMessageOnlyIfNoReply}
              />
            </div>

            {/* Configuracao de acoes dos botoes */}
            {selectedTemplateData && getTemplateButtons(selectedTemplateData).length > 0 && (
              <div className="border-t pt-4">
                <ButtonActionsConfig
                  buttons={getTemplateButtons(selectedTemplateData)}
                  buttonActions={buttonActions}
                  onButtonActionsChange={setButtonActions}
                  customFields={customFields.map(f => ({ name: f.name, label: f.label || f.name }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMessageModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddMessage}
              disabled={addMessage.isPending || !newMessageTemplate}
            >
              {addMessage.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Messages Modal */}
      <Dialog open={showCopyModal} onOpenChange={setShowCopyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar Fluxo de Mensagens</DialogTitle>
            <DialogDescription>
              Copie o fluxo de mensagens de uma WABA para outra. Voce precisara mapear os
              templates depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Copiar de</Label>
              <Select value={copyFromMember || ''} onValueChange={setCopyFromMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a WABA origem" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.waba_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Copiar para</Label>
              <Select value={copyToMember} onValueChange={setCopyToMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a WABA destino" />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter((m) => m.id !== copyFromMember)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.waba_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCopyMessages}
              disabled={duplicateMessages.isPending || !copyFromMember || !copyToMember}
            >
              {duplicateMessages.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Copiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover WABA do pool?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.name} sera removida do pool de aquecimento. Os contatos ja
              adicionados nao serao afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// =============================================
// WARMING ANALYTICS TAB COMPONENT
// =============================================

function WarmingAnalyticsTab({ poolId }: { poolId: string | undefined }) {
  const { data: analytics, isLoading } = useWarmingAnalytics(poolId);
  const { data: funnelData, isLoading: loadingFunnel } = useWarmingFunnel(poolId);

  if (isLoading || loadingFunnel) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum dado de analytics disponivel
        </CardContent>
      </Card>
    );
  }

  const pool = analytics.pool_info;
  const contacts = analytics.contacts_summary || { total: 0, in_progress: 0, completed: 0, replied: 0 };

  // Calcular totais do funil
  const funnelTotals = funnelData?.reduce(
    (acc, item) => ({
      sent: acc.sent + (item.sent || 0),
      delivered: acc.delivered + (item.delivered || 0),
      read: acc.read + (item.read || 0),
      button_clicks: acc.button_clicks + (item.button_clicks || 0),
      link_clicks: acc.link_clicks + (item.link_clicks || 0),
      replied: acc.replied + (item.replied || 0),
    }),
    { sent: 0, delivered: 0, read: 0, button_clicks: 0, link_clicks: 0, replied: 0 }
  ) || { sent: 0, delivered: 0, read: 0, button_clicks: 0, link_clicks: 0, replied: 0 };

  return (
    <div className="space-y-6">
      {/* Funil Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Funil de Conversao
          </CardTitle>
          <CardDescription>
            Acompanhe cada etapa do funil de aquecimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <Send className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-blue-600">{funnelTotals.sent}</p>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-cyan-600" />
              <p className="text-2xl font-bold text-cyan-600">{funnelTotals.delivered}</p>
              <p className="text-xs text-muted-foreground">Entregues</p>
              <p className="text-[10px] text-cyan-600">
                {funnelTotals.sent > 0 ? ((funnelTotals.delivered / funnelTotals.sent) * 100).toFixed(0) : 0}%
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <Eye className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-green-600">{funnelTotals.read}</p>
              <p className="text-xs text-muted-foreground">Lidas</p>
              <p className="text-[10px] text-green-600">
                {funnelTotals.delivered > 0 ? ((funnelTotals.read / funnelTotals.delivered) * 100).toFixed(0) : 0}%
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
              <MousePointerClick className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold text-purple-600">{funnelTotals.button_clicks}</p>
              <p className="text-xs text-muted-foreground">Clique Botao</p>
              <p className="text-[10px] text-purple-600">
                {funnelTotals.read > 0 ? ((funnelTotals.button_clicks / funnelTotals.read) * 100).toFixed(0) : 0}%
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <Link2 className="h-6 w-6 mx-auto mb-2 text-orange-600" />
              <p className="text-2xl font-bold text-orange-600">{funnelTotals.link_clicks}</p>
              <p className="text-xs text-muted-foreground">Clique Link</p>
              <p className="text-[10px] text-orange-600">
                {funnelTotals.read > 0 ? ((funnelTotals.link_clicks / funnelTotals.read) * 100).toFixed(0) : 0}%
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800">
              <MessageCircle className="h-6 w-6 mx-auto mb-2 text-pink-600" />
              <p className="text-2xl font-bold text-pink-600">{funnelTotals.replied}</p>
              <p className="text-xs text-muted-foreground">Respostas</p>
              <p className="text-[10px] text-pink-600">
                {funnelTotals.sent > 0 ? ((funnelTotals.replied / funnelTotals.sent) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Funil por WABA */}
      <Card>
        <CardHeader>
          <CardTitle>Funil por Numero</CardTitle>
          <CardDescription>
            Comparativo de performance entre cada WABA
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!funnelData || funnelData.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum dado disponivel
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WABA</TableHead>
                  <TableHead className="text-center">Enviadas</TableHead>
                  <TableHead className="text-center">Entregues</TableHead>
                  <TableHead className="text-center">Lidas</TableHead>
                  <TableHead className="text-center">Clique Botao</TableHead>
                  <TableHead className="text-center">Clique Link</TableHead>
                  <TableHead className="text-center">Respostas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funnelData.map((item) => (
                  <TableRow key={item.waba_id}>
                    <TableCell className="font-medium">{item.waba_name}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold">{item.sent}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div>
                        <span className="font-bold">{item.delivered}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({item.sent > 0 ? ((item.delivered / item.sent) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div>
                        <span className="font-bold">{item.read}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({item.delivered > 0 ? ((item.read / item.delivered) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div>
                        <span className="font-bold text-purple-600">{item.button_clicks}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({item.read > 0 ? ((item.button_clicks / item.read) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div>
                        <span className="font-bold text-orange-600">{item.link_clicks}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({item.read > 0 ? ((item.link_clicks / item.read) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div>
                        <span className="font-bold text-pink-600">{item.replied}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({item.sent > 0 ? ((item.replied / item.sent) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Enviadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pool?.total_messages_sent?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {pool?.total_messages_today || 0} hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contatos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contacts.in_progress}</div>
            <p className="text-xs text-muted-foreground">
              de {contacts.total} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{contacts.completed}</div>
            <p className="text-xs text-muted-foreground">
              {contacts.total > 0
                ? ((contacts.completed / contacts.total) * 100).toFixed(1)
                : 0}
              % do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Responderam
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{contacts.replied}</div>
            <p className="text-xs text-muted-foreground">
              {contacts.total > 0
                ? ((contacts.replied / contacts.total) * 100).toFixed(1)
                : 0}
              % de engajamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      {analytics.recent_events && analytics.recent_events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Eventos Recentes</CardTitle>
            <CardDescription>Ultimas atividades do pool</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {analytics.recent_events.slice(0, 10).map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    {event.severity === 'warning' ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    ) : event.event_type.includes('paused') ? (
                      <Pause className="h-4 w-4 text-orange-500" />
                    ) : event.event_type.includes('resumed') ? (
                      <Play className="h-4 w-4 text-green-500" />
                    ) : (
                      <History className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{event.event_type.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {event.created_at &&
                      format(new Date(event.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

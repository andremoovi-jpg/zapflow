import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';
import type { Node, Edge } from 'reactflow';

export interface FlowNode {
  id: string;
  flow_id: string;
  type: string;
  name: string | null;
  config: NodeConfig;
  position_x: number;
  position_y: number;
}

export interface FlowEdge {
  id: string;
  flow_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  label: string | null;
}

export interface Flow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: string;
  trigger_type: string;
  trigger_config: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  last_execution_at: string | null;
}

export type NodeType =
  | 'trigger_button_click'
  | 'trigger_keyword'
  | 'trigger_webhook'
  | 'trigger_message'
  | 'trigger_contact_created'
  | 'condition_button'
  | 'condition_tag'
  | 'condition_field'
  | 'condition_time'
  | 'condition_day'
  | 'action_send_text'
  | 'action_send_template'
  | 'action_send_buttons'
  | 'action_send_list'
  | 'action_send_media'
  | 'action_send_cta_url'
  | 'action_add_tag'
  | 'action_remove_tag'
  | 'action_update_field'
  | 'action_webhook'
  | 'action_wait_reply'
  | 'action_delay'
  | 'action_transfer_human'
  | 'action_end';

export interface NodeConfig {
  // Common
  label?: string;
  
  // Trigger configs
  templateId?: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>;
  templateButtons?: Array<{ id: string; text: string; type: string }>;
  waitForButtonResponse?: boolean;
  buttonId?: string;
  keywords?: string[];
  exactMatch?: boolean;
  webhookUrl?: string;
  
  // Action configs
  message?: string;
  variables?: string[];
  body?: string;
  buttons?: Array<{ id: string; text: string }>;
  header?: string;
  buttonText?: string;
  sections?: Array<{
    title: string;
    items: Array<{ id: string; title: string; description?: string }>;
  }>;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio';
  tag?: string;
  field?: string;
  value?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'empty' | 'not_empty';
  
  // Condition configs
  hasTag?: boolean;
  timeRange?: { start: string; end: string };
  days?: number[];
  conditions?: Array<{ buttonText: string; output: string }>;
  
  // Control configs
  amount?: number;
  unit?: 'minutes' | 'hours' | 'days';
  url?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  requestBody?: Record<string, unknown>;
  responseMapping?: Record<string, string>;
  waitOptions?: Array<{ id: string; text: string; timeout?: number }>;
  
  // CTA URL button config
  ctaUrl?: {
    headerText?: string;
    bodyText: string;
    footerText?: string;
    buttonText: string;
    url: string;
  };
}

export const nodeCategories = {
  triggers: [
    { type: 'trigger_button_click', label: 'Clique em Botão', icon: 'MousePointerClick' },
    { type: 'trigger_keyword', label: 'Palavra-chave', icon: 'MessageSquare' },
    { type: 'trigger_webhook', label: 'Webhook Externo', icon: 'Webhook' },
    { type: 'trigger_message', label: 'Mensagem Recebida', icon: 'Mail' },
    { type: 'trigger_contact_created', label: 'Contato Criado', icon: 'UserPlus' },
  ],
  conditions: [
    { type: 'condition_button', label: 'Qual Botão?', icon: 'GitBranch' },
    { type: 'condition_tag', label: 'Verificar Tag', icon: 'Tag' },
    { type: 'condition_field', label: 'Verificar Campo', icon: 'FileText' },
    { type: 'condition_time', label: 'Verificar Horário', icon: 'Clock' },
    { type: 'condition_day', label: 'Verificar Dia', icon: 'Calendar' },
  ],
  actions: [
    { type: 'action_send_text', label: 'Enviar Texto', icon: 'MessageCircle' },
    { type: 'action_send_template', label: 'Enviar Template', icon: 'FileTemplate' },
    { type: 'action_send_buttons', label: 'Enviar Botões', icon: 'LayoutGrid' },
    { type: 'action_send_list', label: 'Enviar Lista', icon: 'List' },
    { type: 'action_send_media', label: 'Enviar Mídia', icon: 'Image' },
    { type: 'action_send_cta_url', label: 'Botão com Link', icon: 'ExternalLink' },
    { type: 'action_add_tag', label: 'Adicionar Tag', icon: 'TagPlus' },
    { type: 'action_remove_tag', label: 'Remover Tag', icon: 'TagMinus' },
    { type: 'action_update_field', label: 'Atualizar Campo', icon: 'Edit' },
    { type: 'action_webhook', label: 'Chamar Webhook', icon: 'Globe' },
    { type: 'action_wait_reply', label: 'Aguardar Resposta', icon: 'MessageSquareMore' },
    { type: 'action_delay', label: 'Aguardar Tempo', icon: 'Timer' },
    { type: 'action_transfer_human', label: 'Transferir Humano', icon: 'UserRound' },
    { type: 'action_end', label: 'Encerrar Fluxo', icon: 'CircleStop' },
  ],
};

export const getNodeCategory = (type: string): 'trigger' | 'condition' | 'action_message' | 'action_data' | 'control' => {
  if (type.startsWith('trigger_')) return 'trigger';
  if (type.startsWith('condition_')) return 'condition';
  if (['action_send_text', 'action_send_template', 'action_send_buttons', 'action_send_list', 'action_send_media', 'action_send_cta_url'].includes(type)) {
    return 'action_message';
  }
  if (['action_add_tag', 'action_remove_tag', 'action_update_field', 'action_webhook'].includes(type)) {
    return 'action_data';
  }
  return 'control';
};

export function useFlows(filter: 'all' | 'active' | 'paused' | 'draft' = 'all', search: string = '') {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['flows', currentOrg?.id, filter, search],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      let query = supabase
        .from('flows')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('updated_at', { ascending: false });

      if (filter === 'active') {
        query = query.eq('is_active', true);
      } else if (filter === 'paused') {
        query = query.eq('status', 'paused');
      } else if (filter === 'draft') {
        query = query.eq('status', 'draft');
      }

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Flow[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useFlow(flowId: string | undefined) {
  return useQuery({
    queryKey: ['flow', flowId],
    queryFn: async () => {
      if (!flowId) return null;

      const { data, error } = await supabase
        .from('flows')
        .select('*')
        .eq('id', flowId)
        .single();

      if (error) throw error;
      return data as Flow;
    },
    enabled: !!flowId,
  });
}

export function useFlowNodes(flowId: string | undefined) {
  return useQuery({
    queryKey: ['flow-nodes', flowId],
    queryFn: async () => {
      if (!flowId) return [];

      const { data, error } = await supabase
        .from('flow_nodes')
        .select('*')
        .eq('flow_id', flowId);

      if (error) throw error;
      return data.map(node => ({
        ...node,
        config: node.config as NodeConfig,
        position_x: node.position_x ?? 0,
        position_y: node.position_y ?? 0,
      })) as FlowNode[];
    },
    enabled: !!flowId,
  });
}

export function useFlowEdges(flowId: string | undefined) {
  return useQuery({
    queryKey: ['flow-edges', flowId],
    queryFn: async () => {
      if (!flowId) return [];

      const { data, error } = await supabase
        .from('flow_edges')
        .select('*')
        .eq('flow_id', flowId);

      if (error) throw error;
      return data as FlowEdge[];
    },
    enabled: !!flowId,
  });
}

export function useCreateFlow() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; trigger_type: string; description?: string }) => {
      if (!currentOrg?.id) throw new Error('No organization selected');

      const { data: flow, error } = await supabase
        .from('flows')
        .insert({
          organization_id: currentOrg.id,
          name: data.name,
          description: data.description || null,
          trigger_type: data.trigger_type,
          trigger_config: {},
          status: 'draft',
          is_active: false,
        })
        .select()
        .single();

      if (error) throw error;
      return flow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast({ title: 'Fluxo criado com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao criar fluxo', variant: 'destructive' });
    },
  });
}

export function useUpdateFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Flow> & { id: string }) => {
      const { error } = await supabase
        .from('flows')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      queryClient.invalidateQueries({ queryKey: ['flow', variables.id] });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar fluxo', variant: 'destructive' });
    },
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (flowId: string) => {
      // Delete edges first (foreign key constraint)
      await supabase.from('flow_edges').delete().eq('flow_id', flowId);
      // Delete nodes
      await supabase.from('flow_nodes').delete().eq('flow_id', flowId);
      // Delete flow
      const { error } = await supabase
        .from('flows')
        .delete()
        .eq('id', flowId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast({ title: 'Fluxo excluído com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir fluxo', variant: 'destructive' });
    },
  });
}

export function useDuplicateFlow() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (flowId: string) => {
      if (!currentOrg?.id) throw new Error('No organization selected');

      // Fetch original flow
      const { data: originalFlow, error: flowError } = await supabase
        .from('flows')
        .select('*')
        .eq('id', flowId)
        .single();

      if (flowError) throw flowError;

      // Create new flow
      const { data: newFlow, error: newFlowError } = await supabase
        .from('flows')
        .insert({
          organization_id: currentOrg.id,
          name: `${originalFlow.name} (cópia)`,
          description: originalFlow.description,
          trigger_type: originalFlow.trigger_type,
          trigger_config: originalFlow.trigger_config,
          status: 'draft',
          is_active: false,
        })
        .select()
        .single();

      if (newFlowError) throw newFlowError;

      // Fetch original nodes
      const { data: originalNodes, error: nodesError } = await supabase
        .from('flow_nodes')
        .select('*')
        .eq('flow_id', flowId);

      if (nodesError) throw nodesError;

      // Create node ID mapping
      const nodeIdMap: Record<string, string> = {};
      const newNodes = originalNodes.map((node) => {
        const newId = crypto.randomUUID();
        nodeIdMap[node.id] = newId;
        return {
          id: newId,
          flow_id: newFlow.id,
          type: node.type,
          name: node.name,
          config: node.config,
          position_x: node.position_x,
          position_y: node.position_y,
        };
      });

      if (newNodes.length > 0) {
        const { error: insertNodesError } = await supabase
          .from('flow_nodes')
          .insert(newNodes);
        if (insertNodesError) throw insertNodesError;
      }

      // Fetch original edges
      const { data: originalEdges, error: edgesError } = await supabase
        .from('flow_edges')
        .select('*')
        .eq('flow_id', flowId);

      if (edgesError) throw edgesError;

      // Create new edges with mapped node IDs
      const newEdges = originalEdges.map((edge) => ({
        id: crypto.randomUUID(),
        flow_id: newFlow.id,
        source_node_id: nodeIdMap[edge.source_node_id],
        target_node_id: nodeIdMap[edge.target_node_id],
        source_handle: edge.source_handle,
        label: edge.label,
      }));

      if (newEdges.length > 0) {
        const { error: insertEdgesError } = await supabase
          .from('flow_edges')
          .insert(newEdges);
        if (insertEdgesError) throw insertEdgesError;
      }

      return newFlow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast({ title: 'Fluxo duplicado com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao duplicar fluxo', variant: 'destructive' });
    },
  });
}

export function useSaveFlowCanvas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      flowId,
      nodes,
      edges,
    }: {
      flowId: string;
      nodes: Array<{ id: string; type: string; name: string; config: NodeConfig; position_x: number; position_y: number }>;
      edges: Array<{ id: string; source_node_id: string; target_node_id: string; source_handle?: string; label?: string }>;
    }) => {
      // Delete existing nodes and edges
      await supabase.from('flow_edges').delete().eq('flow_id', flowId);
      await supabase.from('flow_nodes').delete().eq('flow_id', flowId);

      // Insert new nodes
      if (nodes.length > 0) {
        const { error: nodesError } = await supabase.from('flow_nodes').insert(
          nodes.map((node) => ({
            id: node.id,
            flow_id: flowId,
            type: node.type,
            name: node.name,
            config: node.config as Json,
            position_x: node.position_x,
            position_y: node.position_y,
          }))
        );
        if (nodesError) throw nodesError;
      }

      // Insert new edges (let DB generate UUID for id)
      if (edges.length > 0) {
        const { error: edgesError } = await supabase.from('flow_edges').insert(
          edges.map((edge) => ({
            flow_id: flowId,
            source_node_id: edge.source_node_id,
            target_node_id: edge.target_node_id,
            source_handle: edge.source_handle || null,
            label: edge.label || null,
          }))
        );
        if (edgesError) throw edgesError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['flow-nodes', variables.flowId] });
      queryClient.invalidateQueries({ queryKey: ['flow-edges', variables.flowId] });
      toast({ title: 'Fluxo salvo com sucesso!' });
    },
    onError: (error: any) => {
      console.error('Erro ao salvar fluxo:', error);
      const details = error?.message || error?.details || error?.hint || 'Erro desconhecido';
      toast({ 
        title: 'Erro ao salvar fluxo', 
        description: details,
        variant: 'destructive' 
      });
    },
  });
}

export function useToggleFlowActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ flowId, isActive }: { flowId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('flows')
        .update({ 
          is_active: isActive,
          status: isActive ? 'active' : 'paused',
        })
        .eq('id', flowId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      queryClient.invalidateQueries({ queryKey: ['flow', variables.flowId] });
      toast({ 
        title: variables.isActive ? 'Fluxo ativado!' : 'Fluxo pausado!',
      });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    },
  });
}

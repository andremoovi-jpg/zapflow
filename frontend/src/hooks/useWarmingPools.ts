import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

// Types
export type WarmingPool = Tables<'warming_pools'>;
export type WarmingPoolMember = Tables<'warming_pool_members'>;
export type WarmingPoolFlow = Tables<'warming_pool_flows'>;
export type WarmingContactHistory = Tables<'warming_contact_history'>;
export type WarmingEventLog = Tables<'warming_events_log'>;

export type CreateWarmingPoolData = Omit<TablesInsert<'warming_pools'>, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;
export type UpdateWarmingPoolData = Partial<CreateWarmingPoolData> & { id: string };

export interface WarmingPoolMemberWithWaba extends WarmingPoolMember {
  waba_name: string;
  waba_status: string;
}

export interface WarmingPoolFlowWithDetails extends WarmingPoolFlow {
  flow_name: string;
  flow_trigger_type: string;
}

export interface WarmingPoolStats {
  pool: WarmingPool;
  members: WarmingPoolMemberWithWaba[];
  flows: WarmingPoolFlowWithDetails[];
  contacts_summary: {
    total: number;
    in_progress: number;
    completed: number;
    failed: number;
  };
  recent_events: WarmingEventLog[];
}

// ================== POOLS ==================

export function useWarmingPools() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['warming-pools', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('warming_pools')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WarmingPool[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useWarmingPool(poolId: string | undefined) {
  return useQuery({
    queryKey: ['warming-pool', poolId],
    queryFn: async () => {
      if (!poolId) return null;

      const { data, error } = await supabase
        .from('warming_pools')
        .select('*')
        .eq('id', poolId)
        .maybeSingle();

      if (error) throw error;
      return data as WarmingPool | null;
    },
    enabled: !!poolId,
  });
}

export function useWarmingPoolStats(poolId: string | undefined) {
  return useQuery({
    queryKey: ['warming-pool-stats', poolId],
    queryFn: async () => {
      if (!poolId) return null;

      const { data, error } = await supabase.rpc('get_warming_pool_stats', {
        pool_id: poolId,
      });

      if (error) throw error;
      return data as WarmingPoolStats | null;
    },
    enabled: !!poolId,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
}

export function useCreateWarmingPool() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();

  return useMutation({
    mutationFn: async (data: CreateWarmingPoolData) => {
      if (!currentOrg?.id) throw new Error('Organização não selecionada');

      const { data: pool, error } = await supabase
        .from('warming_pools')
        .insert({
          ...data,
          organization_id: currentOrg.id,
        })
        .select()
        .single();

      if (error) throw error;
      return pool as WarmingPool;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-pools'] });
      toast.success('Pool de aquecimento criado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar pool: ' + error.message);
    },
  });
}

export function useUpdateWarmingPool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateWarmingPoolData) => {
      const { error } = await supabase
        .from('warming_pools')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pools'] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats', variables.id] });
      toast.success('Pool atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useDeleteWarmingPool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (poolId: string) => {
      const { error } = await supabase
        .from('warming_pools')
        .delete()
        .eq('id', poolId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-pools'] });
      toast.success('Pool removido!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });
}

export function usePauseWarmingPool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (poolId: string) => {
      const { error } = await supabase
        .from('warming_pools')
        .update({ status: 'paused' })
        .eq('id', poolId);

      if (error) throw error;

      // Log do evento
      await supabase.from('warming_events_log').insert({
        warming_pool_id: poolId,
        event_type: 'pool_paused',
        event_data: { paused_at: new Date().toISOString() },
        severity: 'warning',
      });
    },
    onSuccess: (_, poolId) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pools'] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool', poolId] });
      toast.success('Pool pausado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao pausar: ' + error.message);
    },
  });
}

export function useResumeWarmingPool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (poolId: string) => {
      const { error } = await supabase
        .from('warming_pools')
        .update({ status: 'active' })
        .eq('id', poolId);

      if (error) throw error;

      // Log do evento
      await supabase.from('warming_events_log').insert({
        warming_pool_id: poolId,
        event_type: 'pool_resumed',
        event_data: { resumed_at: new Date().toISOString() },
        severity: 'info',
      });
    },
    onSuccess: (_, poolId) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pools'] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool', poolId] });
      toast.success('Pool retomado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao retomar: ' + error.message);
    },
  });
}

// ================== MEMBERS ==================

export function useWarmingPoolMembers(poolId: string | undefined) {
  return useQuery({
    queryKey: ['warming-pool-members', poolId],
    queryFn: async () => {
      if (!poolId) return [];

      const { data, error } = await supabase
        .from('warming_pool_members')
        .select(`
          *,
          whatsapp_accounts!inner(id, name, status)
        `)
        .eq('warming_pool_id', poolId)
        .order('priority', { ascending: false });

      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        waba_name: (item.whatsapp_accounts as any)?.name || 'Desconhecido',
        waba_status: (item.whatsapp_accounts as any)?.status || 'unknown',
      })) as WarmingPoolMemberWithWaba[];
    },
    enabled: !!poolId,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
}

export function useAddWarmingPoolMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poolId, wabaId, priority, customDailyLimit }: {
      poolId: string;
      wabaId: string;
      priority?: number;
      customDailyLimit?: number;
    }) => {
      const { data, error } = await supabase
        .from('warming_pool_members')
        .insert({
          warming_pool_id: poolId,
          whatsapp_account_id: wabaId,
          priority: priority || 5,
          custom_daily_limit: customDailyLimit,
          warmup_started_at: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;

      // Log do evento
      await supabase.from('warming_events_log').insert({
        warming_pool_id: poolId,
        whatsapp_account_id: wabaId,
        event_type: 'waba_added',
        event_data: { priority, custom_daily_limit: customDailyLimit },
        severity: 'info',
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pool-members', variables.poolId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats', variables.poolId] });
      toast.success('WABA adicionada ao pool!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar: ' + error.message);
    },
  });
}

export function useUpdateWarmingPoolMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, poolId, ...data }: {
      id: string;
      poolId: string;
      priority?: number;
      custom_daily_limit?: number | null;
      status?: string;
      traffic_weight?: number;
    }) => {
      const { error } = await supabase
        .from('warming_pool_members')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pool-members', variables.poolId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats', variables.poolId] });
      toast.success('Membro atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useRemoveWarmingPoolMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, poolId, wabaId }: { id: string; poolId: string; wabaId: string }) => {
      const { error } = await supabase
        .from('warming_pool_members')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log do evento
      await supabase.from('warming_events_log').insert({
        warming_pool_id: poolId,
        whatsapp_account_id: wabaId,
        event_type: 'waba_removed',
        severity: 'warning',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pool-members', variables.poolId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats', variables.poolId] });
      toast.success('WABA removida do pool!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });
}

export function usePauseWarmingPoolMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, poolId, wabaId, reason }: {
      id: string;
      poolId: string;
      wabaId: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from('warming_pool_members')
        .update({
          status: 'paused',
          pause_reason: reason,
          paused_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Log do evento
      await supabase.from('warming_events_log').insert({
        warming_pool_id: poolId,
        whatsapp_account_id: wabaId,
        event_type: 'waba_paused',
        event_data: { reason },
        severity: 'warning',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pool-members', variables.poolId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats', variables.poolId] });
      toast.success('WABA pausada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao pausar: ' + error.message);
    },
  });
}

export function useResumeWarmingPoolMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, poolId, wabaId }: { id: string; poolId: string; wabaId: string }) => {
      const { error } = await supabase
        .from('warming_pool_members')
        .update({
          status: 'active',
          pause_reason: null,
          paused_at: null,
        })
        .eq('id', id);

      if (error) throw error;

      // Log do evento
      await supabase.from('warming_events_log').insert({
        warming_pool_id: poolId,
        whatsapp_account_id: wabaId,
        event_type: 'waba_resumed',
        severity: 'info',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pool-members', variables.poolId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats', variables.poolId] });
      toast.success('WABA retomada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao retomar: ' + error.message);
    },
  });
}

// ================== FLOWS ==================

export function useWarmingPoolFlows(poolId: string | undefined) {
  return useQuery({
    queryKey: ['warming-pool-flows', poolId],
    queryFn: async () => {
      if (!poolId) return [];

      const { data, error } = await supabase
        .from('warming_pool_flows')
        .select(`
          *,
          flows!inner(id, name, trigger_type)
        `)
        .eq('warming_pool_id', poolId)
        .order('sequence_order', { ascending: true });

      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        flow_name: (item.flows as any)?.name || 'Desconhecido',
        flow_trigger_type: (item.flows as any)?.trigger_type || 'unknown',
      })) as WarmingPoolFlowWithDetails[];
    },
    enabled: !!poolId,
  });
}

export function useAddWarmingPoolFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      poolId,
      flowId,
      delayDays,
      delayHours,
      sequenceOrder,
    }: {
      poolId: string;
      flowId: string;
      delayDays?: number;
      delayHours?: number;
      sequenceOrder?: number;
    }) => {
      // Se não especificar ordem, colocar no final
      let order = sequenceOrder;
      if (order === undefined) {
        const { data: existing } = await supabase
          .from('warming_pool_flows')
          .select('sequence_order')
          .eq('warming_pool_id', poolId)
          .order('sequence_order', { ascending: false })
          .limit(1);

        order = existing && existing.length > 0 ? (existing[0].sequence_order || 0) + 1 : 1;
      }

      const { data, error } = await supabase
        .from('warming_pool_flows')
        .insert({
          warming_pool_id: poolId,
          flow_id: flowId,
          delay_days: delayDays || 0,
          delay_hours: delayHours || 0,
          sequence_order: order,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pool-flows', variables.poolId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats', variables.poolId] });
      toast.success('Flow adicionado ao aquecimento!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar flow: ' + error.message);
    },
  });
}

export function useUpdateWarmingPoolFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      poolId,
      ...data
    }: {
      id: string;
      poolId: string;
      delay_days?: number;
      delay_hours?: number;
      sequence_order?: number;
      is_active?: boolean;
      only_if_engaged?: boolean;
      skip_if_replied?: boolean;
    }) => {
      const { error } = await supabase
        .from('warming_pool_flows')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pool-flows', variables.poolId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats', variables.poolId] });
      toast.success('Flow atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useRemoveWarmingPoolFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, poolId }: { id: string; poolId: string }) => {
      const { error } = await supabase
        .from('warming_pool_flows')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-pool-flows', variables.poolId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats', variables.poolId] });
      toast.success('Flow removido!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });
}

// ================== CONTACT HISTORY ==================

export function useWarmingContactHistory(poolId: string | undefined, limit: number = 50) {
  return useQuery({
    queryKey: ['warming-contact-history', poolId, limit],
    queryFn: async () => {
      if (!poolId) return [];

      const { data, error } = await supabase
        .from('warming_contact_history')
        .select(`
          *,
          contacts!inner(id, name, phone_number),
          whatsapp_accounts!inner(id, name)
        `)
        .eq('warming_pool_id', poolId)
        .order('entered_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!poolId,
  });
}

// ================== EVENTS LOG ==================

export function useWarmingEventsLog(poolId: string | undefined, limit: number = 100) {
  return useQuery({
    queryKey: ['warming-events-log', poolId, limit],
    queryFn: async () => {
      if (!poolId) return [];

      const { data, error } = await supabase
        .from('warming_events_log')
        .select('*')
        .eq('warming_pool_id', poolId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as WarmingEventLog[];
    },
    enabled: !!poolId,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
}

// ================== WABA SELECTION (Backend Call) ==================

export function useSelectWarmingWaba() {
  return useMutation({
    mutationFn: async (poolId: string) => {
      const { data, error } = await supabase.rpc('select_warming_waba', {
        pool_id: poolId,
      });

      if (error) throw error;
      return data as string | null; // Returns WABA ID or null
    },
  });
}

// ================== MEMBER MESSAGES (Fluxo por WABA) ==================

export type WarmingMemberMessage = Tables<'warming_member_messages'>;

export interface WarmingMemberMessageWithTemplate extends WarmingMemberMessage {
  template_status?: string;
}

export function useWarmingMemberMessages(memberId: string | undefined) {
  return useQuery({
    queryKey: ['warming-member-messages', memberId],
    queryFn: async () => {
      if (!memberId) return [];

      const { data, error } = await supabase
        .from('warming_member_messages')
        .select('*')
        .eq('warming_pool_member_id', memberId)
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      return data as WarmingMemberMessage[];
    },
    enabled: !!memberId,
  });
}

export function useAllPoolMemberMessages(poolId: string | undefined) {
  return useQuery({
    queryKey: ['warming-pool-all-messages', poolId],
    queryFn: async () => {
      if (!poolId) return [];

      // Buscar todos os membros do pool
      const { data: members, error: membersError } = await supabase
        .from('warming_pool_members')
        .select('id')
        .eq('warming_pool_id', poolId);

      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      const memberIds = members.map(m => m.id);

      // Buscar todas as mensagens dos membros
      const { data, error } = await supabase
        .from('warming_member_messages')
        .select('*')
        .in('warming_pool_member_id', memberIds)
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      return data as WarmingMemberMessage[];
    },
    enabled: !!poolId,
  });
}

export function useAddWarmingMemberMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      poolId,
      templateId,
      templateName,
      templateLanguage,
      templateVariables,
      delayDays,
      delayHours,
      delayMinutes,
      onlyIfNoReply,
      sequenceOrder,
      buttonActions,
    }: {
      memberId: string;
      poolId: string;
      templateId?: string;
      templateName: string;
      templateLanguage?: string;
      templateVariables?: Record<string, any>;
      delayDays?: number;
      delayHours?: number;
      delayMinutes?: number;
      onlyIfNoReply?: boolean;
      sequenceOrder?: number;
      buttonActions?: Record<string, any>;
    }) => {
      // Se não especificar ordem, colocar no final
      let order = sequenceOrder;
      if (order === undefined) {
        const { data: existing } = await supabase
          .from('warming_member_messages')
          .select('sequence_order')
          .eq('warming_pool_member_id', memberId)
          .order('sequence_order', { ascending: false })
          .limit(1);

        order = existing && existing.length > 0 ? (existing[0].sequence_order || 0) + 1 : 1;
      }

      const { data, error } = await supabase
        .from('warming_member_messages')
        .insert({
          warming_pool_member_id: memberId,
          template_id: templateId,
          template_name: templateName,
          template_language: templateLanguage || 'pt_BR',
          template_variables: templateVariables || {},
          delay_days: delayDays || 0,
          delay_hours: delayHours || 0,
          delay_minutes: delayMinutes || 0,
          only_if_no_reply: onlyIfNoReply ?? true,
          sequence_order: order,
          button_actions: buttonActions || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-member-messages', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-all-messages', variables.poolId] });
      toast.success('Mensagem adicionada ao fluxo!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar mensagem: ' + error.message);
    },
  });
}

export function useUpdateWarmingMemberMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      memberId,
      poolId,
      ...data
    }: {
      id: string;
      memberId: string;
      poolId: string;
      template_id?: string | null;
      template_name?: string;
      template_language?: string;
      template_variables?: Record<string, any>;
      delay_days?: number;
      delay_hours?: number;
      delay_minutes?: number;
      only_if_no_reply?: boolean;
      skip_if_clicked?: boolean;
      require_previous_delivered?: boolean;
      is_active?: boolean;
      sequence_order?: number;
      button_actions?: Record<string, any>;
    }) => {
      const { error } = await supabase
        .from('warming_member_messages')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-member-messages', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-all-messages', variables.poolId] });
      toast.success('Mensagem atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useRemoveWarmingMemberMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, memberId, poolId }: { id: string; memberId: string; poolId: string }) => {
      const { error } = await supabase
        .from('warming_member_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-member-messages', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-all-messages', variables.poolId] });
      toast.success('Mensagem removida!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });
}

export function useDuplicateWarmingMemberMessages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fromMemberId,
      toMemberId,
      poolId,
      templateMapping,
    }: {
      fromMemberId: string;
      toMemberId: string;
      poolId: string;
      templateMapping?: Record<string, { templateId: string; templateName: string }>;
    }) => {
      // Buscar mensagens do membro origem
      const { data: sourceMessages, error: fetchError } = await supabase
        .from('warming_member_messages')
        .select('*')
        .eq('warming_pool_member_id', fromMemberId)
        .order('sequence_order', { ascending: true });

      if (fetchError) throw fetchError;
      if (!sourceMessages || sourceMessages.length === 0) {
        throw new Error('Nenhuma mensagem para copiar');
      }

      // Criar cópias para o membro destino
      const newMessages = sourceMessages.map(msg => {
        const mapped = templateMapping?.[msg.id];
        return {
          warming_pool_member_id: toMemberId,
          sequence_order: msg.sequence_order,
          template_id: mapped?.templateId || msg.template_id,
          template_name: mapped?.templateName || msg.template_name,
          template_language: msg.template_language,
          template_variables: msg.template_variables,
          delay_days: msg.delay_days,
          delay_hours: msg.delay_hours,
          delay_minutes: msg.delay_minutes,
          only_if_no_reply: msg.only_if_no_reply,
          skip_if_clicked: msg.skip_if_clicked,
          require_previous_delivered: msg.require_previous_delivered,
          is_active: msg.is_active,
        };
      });

      const { error: insertError } = await supabase
        .from('warming_member_messages')
        .insert(newMessages);

      if (insertError) throw insertError;

      return newMessages.length;
    },
    onSuccess: (count, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warming-member-messages', variables.toMemberId] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-all-messages', variables.poolId] });
      toast.success(`${count} mensagens copiadas!`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao copiar: ' + error.message);
    },
  });
}

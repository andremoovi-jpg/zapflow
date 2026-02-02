import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

export interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  phone_number_id: string | null;
  whatsapp_account_id: string | null;
  status: string;
  audience_type: string | null;
  audience_filter: Record<string, any> | null;
  audience_count: number;
  template_variables: Record<string, string> | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  stats: CampaignStats;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  contact_id: string;
  message_id: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  contact?: {
    id: string;
    name: string | null;
    phone_number: string;
  };
}

interface CampaignFilters {
  status?: string;
  search?: string;
}

export function useCampaigns(filters: CampaignFilters = {}) {
  const { currentOrg } = useOrganization();
  const organizationId = currentOrg?.id;

  return useQuery({
    queryKey: ['campaigns', organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('campaigns')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(c => ({
        ...c,
        stats: (c.stats as unknown as CampaignStats) || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        audience_filter: c.audience_filter as Record<string, any> | null,
        template_variables: c.template_variables as Record<string, string> | null,
      })) as Campaign[];
    },
    enabled: !!organizationId,
  });
}

export function useCampaign(campaignId: string | undefined) {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        stats: (data.stats as unknown as CampaignStats) || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        audience_filter: data.audience_filter as Record<string, any> | null,
        template_variables: data.template_variables as Record<string, string> | null,
      } as Campaign;
    },
    enabled: !!campaignId && !!currentOrg?.id,
  });
}

export function useCampaignMessages(campaignId: string | undefined, filters: { status?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ['campaign-messages', campaignId, filters],
    queryFn: async () => {
      if (!campaignId) return [];

      let query = supabase
        .from('campaign_messages')
        .select(`
          *,
          contact:contacts(id, name, phone_number)
        `)
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      let results = data || [];

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(m => 
          m.contact?.phone_number?.includes(filters.search!) ||
          m.contact?.name?.toLowerCase().includes(searchLower)
        );
      }

      return results as CampaignMessage[];
    },
    enabled: !!campaignId,
  });
}

export function useCampaignStats() {
  const { currentOrg } = useOrganization();
  const organizationId = currentOrg?.id;

  return useQuery({
    queryKey: ['campaign-stats', organizationId],
    queryFn: async () => {
      if (!organizationId) return { active: 0, totalSent: 0, deliveryRate: 0, scheduled: 0 };

      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('status, stats')
        .eq('organization_id', organizationId);

      if (error) throw error;

      const active = campaigns?.filter(c => c.status === 'running').length || 0;
      const scheduled = campaigns?.filter(c => c.status === 'scheduled').length || 0;
      
      let totalSent = 0;
      let totalDelivered = 0;

      campaigns?.forEach(c => {
        const stats = c.stats as unknown as CampaignStats;
        if (stats) {
          totalSent += stats.sent || 0;
          totalDelivered += stats.delivered || 0;
        }
      });

      const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100 * 10) / 10 : 0;

      return { active, totalSent, deliveryRate, scheduled };
    },
    enabled: !!organizationId,
  });
}

export type ActionType =
  | 'send_text'
  | 'send_image'
  | 'send_cta_url'
  | 'send_buttons'
  | 'delay'
  | 'add_tag'
  | 'webhook';

export interface FlowAction {
  id: string;
  type: ActionType;
  message?: string;
  imageUrl?: string;
  imageCaption?: string;
  ctaHeader?: string;
  ctaText?: string;
  ctaFooter?: string;
  ctaUrl?: string;
  ctaButtonText?: string;
  buttonsText?: string;
  buttons?: Array<{ id: string; text: string }>;
  buttonFlows?: Record<string, FlowAction[]>;
  delaySeconds?: number;
  tag?: string;
  webhookUrl?: string;
}

export interface CreateCampaignData {
  name: string;
  description?: string;
  template_id?: string;
  phone_number_id?: string;
  whatsapp_account_id?: string;
  audience_type: string;
  audience_filter?: Record<string, any>;
  audience_count: number;
  template_variables?: Record<string, string>;
  scheduled_at?: string | null;
  status: string;
  button_actions?: Record<string, FlowAction[]>;
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();

  return useMutation({
    mutationFn: async (data: CreateCampaignData) => {
      if (!currentOrg?.id) throw new Error('Organização não selecionada');

      const insertData: Record<string, unknown> = {
        ...data,
        organization_id: currentOrg.id,
        stats: JSON.parse(JSON.stringify({ total: data.audience_count, sent: 0, delivered: 0, read: 0, failed: 0 })),
      };

      // Garantir que button_actions seja serializado corretamente
      if (data.button_actions) {
        insertData.button_actions = JSON.parse(JSON.stringify(data.button_actions));
      }

      const { data: result, error } = await supabase
        .from('campaigns')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
      toast.success('Campanha criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar campanha: ' + error.message);
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stats, audience_filter, template_variables, ...rest }: Partial<Campaign> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...rest };
      
      if (stats !== undefined) {
        updateData.stats = JSON.parse(JSON.stringify(stats));
      }
      if (audience_filter !== undefined) {
        updateData.audience_filter = JSON.parse(JSON.stringify(audience_filter));
      }
      if (template_variables !== undefined) {
        updateData.template_variables = JSON.parse(JSON.stringify(template_variables));
      }

      const { error } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar campanha: ' + error.message);
    },
  });
}

export function useDuplicateCampaign() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data: original, error: fetchError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (fetchError) throw fetchError;

      const { id, created_at, updated_at, started_at, completed_at, ...rest } = original;

      const { data: newCampaign, error } = await supabase
        .from('campaigns')
        .insert({
          ...rest,
          name: `${original.name} (cópia)`,
          status: 'draft',
          scheduled_at: null,
          stats: JSON.parse(JSON.stringify({ total: original.audience_count || 0, sent: 0, delivered: 0, read: 0, failed: 0 })),
        })
        .select()
        .single();

      if (error) throw error;
      return newCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha duplicada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao duplicar: ' + error.message);
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
      toast.success('Campanha excluída!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });
}

const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

// Hook para iniciar campanha via backend API
export function useStartCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao iniciar campanha');
      }

      return response.json();
    },
    onSuccess: (data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
      toast.success(`Campanha iniciada! ${data.total} contatos na fila.`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao iniciar campanha: ' + error.message);
    },
  });
}

// Interface para métricas de campanha
export interface CampaignMetricPoint {
  id: string;
  campaign_id: string;
  messages_sent: number;
  messages_per_second: number;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  recorded_at: string;
}

export interface CampaignMetricsData {
  history: CampaignMetricPoint[];
  realtime: {
    campaignId: string;
    sent: number;
    delivered: number;
    failed: number;
    msgsPerSecond: number;
    elapsedSeconds: number;
  } | null;
  summary: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    avgSpeed: number;
    maxSpeed: number;
    duration: number;
  } | null;
}

// Hook para buscar métricas históricas de uma campanha
export function useCampaignMetrics(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-metrics', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;

      const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/metrics`);

      if (!response.ok) {
        throw new Error('Erro ao buscar métricas da campanha');
      }

      return response.json() as Promise<CampaignMetricsData>;
    },
    enabled: !!campaignId,
    refetchInterval: 5000, // Atualiza a cada 5 segundos durante campanha ativa
  });
}

// Real-time subscription hook for campaign updates
export function useCampaignRealtime(campaignId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns',
          filter: `id=eq.${campaignId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_messages',
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['campaign-messages', campaignId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, queryClient]);
}

// Interface para eventos do funil
export interface FunnelEvent {
  id: string;
  campaign_id: string;
  contact_id: string;
  button_text: string;
  step_index: number;
  action_type: string;
  action_label: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  contact?: {
    id: string;
    name: string | null;
    phone_number: string;
  };
}

export interface FunnelStepStats {
  stepIndex: number;
  actionType: string;
  actionLabel: string;
  count: number;
  percentage: number;
}

export interface FunnelAnalytics {
  buttonText: string;
  totalClicks: number;
  steps: FunnelStepStats[];
  contacts: FunnelEvent[];
}

// Hook para buscar analytics do funil de uma campanha
export function useCampaignFunnel(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-funnel', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;

      const { data: events, error } = await supabase
        .from('campaign_funnel_events')
        .select(`
          *,
          contact:contacts(id, name, phone_number)
        `)
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!events || events.length === 0) return null;

      // Agrupar por botão
      const byButton: Record<string, FunnelEvent[]> = {};
      events.forEach((event: FunnelEvent) => {
        if (!byButton[event.button_text]) {
          byButton[event.button_text] = [];
        }
        byButton[event.button_text].push(event);
      });

      // Calcular estatísticas para cada botão
      const analytics: FunnelAnalytics[] = Object.entries(byButton).map(([buttonText, buttonEvents]) => {
        // Contar cliques únicos (step_index = 0)
        const uniqueContacts = new Set(buttonEvents.map(e => e.contact_id));
        const totalClicks = buttonEvents.filter(e => e.step_index === 0).length;

        // Agrupar por etapa
        const stepCounts: Record<number, { type: string; label: string; contacts: Set<string> }> = {};
        buttonEvents.forEach(event => {
          if (!stepCounts[event.step_index]) {
            stepCounts[event.step_index] = {
              type: event.action_type,
              label: event.action_label || event.action_type,
              contacts: new Set()
            };
          }
          stepCounts[event.step_index].contacts.add(event.contact_id);
        });

        const steps: FunnelStepStats[] = Object.entries(stepCounts)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([stepIdx, data]) => ({
            stepIndex: Number(stepIdx),
            actionType: data.type,
            actionLabel: data.label,
            count: data.contacts.size,
            percentage: totalClicks > 0 ? Math.round((data.contacts.size / totalClicks) * 100) : 0
          }));

        return {
          buttonText,
          totalClicks,
          steps,
          contacts: buttonEvents
        };
      });

      return analytics;
    },
    enabled: !!campaignId,
    refetchInterval: 10000,
  });
}

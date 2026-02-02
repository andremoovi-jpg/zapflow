import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// =============================================
// TIPOS
// =============================================

interface CampaignAnalytics {
  summary: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
    delivery_rate: number;
    read_rate: number;
  };
  hourly_distribution: Array<{
    hour: number;
    sent: number;
    delivered: number;
    read: number;
  }>;
  errors: Array<{
    error: string;
    count: number;
  }>;
}

interface FlowAnalytics {
  summary: {
    total_executions: number;
    completed: number;
    running: number;
    paused: number;
    failed: number;
    completion_rate: number;
  };
  daily_trend: Array<{
    date: string;
    started: number;
    completed: number;
  }>;
  node_stats: Array<{
    node_id: string;
    node_name: string;
    executions: number;
    avg_duration_ms: number;
  }>;
}

interface PhonePerformance {
  phone_number_id: string;
  display_name: string;
  phone_number: string;
  quality_rating: string;
  waba_name: string;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  delivery_rate: number;
  read_rate: number;
}

interface DashboardAnalytics {
  messages: {
    total_sent: number;
    total_received: number;
    delivered: number;
    read: number;
    failed: number;
  };
  campaigns: {
    total: number;
    running: number;
    completed: number;
    total_messages: number;
    total_delivered: number;
    total_read: number;
  };
  flows: {
    total_active: number;
    total_executions: number;
    completed_executions: number;
  };
  contacts: {
    total: number;
    new_this_period: number;
    active_this_period: number;
  };
  daily_trend: Array<{
    date: string;
    sent: number;
    received: number;
    delivered: number;
    read: number;
  }>;
  top_campaigns: Array<{
    id: string;
    name: string;
    total: number;
    read_rate: number;
  }>;
  link_clicks: {
    total_clicks: number;
    unique_contacts: number;
  };
}

interface WarmingAnalytics {
  pool_info: {
    name: string;
    status: string;
    total_messages_sent: number;
    total_messages_today: number;
  };
  members: Array<{
    waba_id: string;
    waba_name: string;
    status: string;
    quality: string;
    messages_sent_today: number;
    daily_limit: number;
    usage_percent: number;
    warmup_day: number;
  }>;
  recent_events: Array<{
    event_type: string;
    event_data: any;
    severity: string;
    created_at: string;
  }>;
  contacts_summary: {
    total: number;
    in_progress: number;
    completed: number;
    replied: number;
  };
}

interface WarmingFunnelItem {
  waba_id: string;
  waba_name: string;
  sent: number;
  delivered: number;
  read: number;
  button_clicks: number;
  link_clicks: number;
  replied: number;
}

// =============================================
// HOOKS
// =============================================

export function useCampaignAnalytics(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign-analytics", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;

      const { data, error } = await supabase.rpc("get_campaign_analytics", {
        p_campaign_id: campaignId,
      });

      if (error) throw error;
      return data as CampaignAnalytics;
    },
    enabled: !!campaignId,
    refetchInterval: 30000, // Atualiza a cada 30s
  });
}

export function useFlowAnalytics(flowId: string | undefined) {
  return useQuery({
    queryKey: ["flow-analytics", flowId],
    queryFn: async () => {
      if (!flowId) return null;

      const { data, error } = await supabase.rpc("get_flow_analytics", {
        p_flow_id: flowId,
      });

      if (error) throw error;
      return data as FlowAnalytics;
    },
    enabled: !!flowId,
    refetchInterval: 30000,
  });
}

export function usePhonePerformance(orgId: string | undefined, days: number = 7) {
  return useQuery({
    queryKey: ["phone-performance", orgId, days],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase.rpc("get_phone_performance", {
        p_org_id: orgId,
        p_days: days,
      });

      if (error) throw error;
      return data as PhonePerformance[];
    },
    enabled: !!orgId,
    refetchInterval: 60000, // Atualiza a cada 1 min
  });
}

export function useDashboardAnalytics(orgId: string | undefined, days: number = 7) {
  return useQuery({
    queryKey: ["dashboard-analytics", orgId, days],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase.rpc("get_dashboard_analytics", {
        p_org_id: orgId,
        p_days: days,
      });

      if (error) throw error;
      return data as DashboardAnalytics;
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });
}

export function useWarmingAnalytics(poolId: string | undefined) {
  return useQuery({
    queryKey: ["warming-analytics", poolId],
    queryFn: async () => {
      if (!poolId) return null;

      const { data, error } = await supabase.rpc("get_warming_analytics", {
        p_pool_id: poolId,
      });

      if (error) throw error;
      return data as WarmingAnalytics;
    },
    enabled: !!poolId,
    refetchInterval: 30000,
  });
}

export function useWarmingFunnel(poolId: string | undefined) {
  return useQuery({
    queryKey: ["warming-funnel", poolId],
    queryFn: async () => {
      if (!poolId) return null;

      const { data, error } = await supabase.rpc("get_warming_funnel", {
        p_pool_id: poolId,
      });

      if (error) throw error;
      return data as WarmingFunnelItem[];
    },
    enabled: !!poolId,
    refetchInterval: 30000,
  });
}

// =============================================
// TIPOS EXPORTADOS
// =============================================

// =============================================
// FLOW NODE STATS (para editor visual)
// =============================================

interface FlowNodeStats {
  [nodeId: string]: {
    entered: number;
    completed: number;
    failed: number;
    completion_rate: number;
    button_clicks?: { [buttonId: string]: number };
    avg_time_ms?: number;
  };
}

export function useFlowNodeStats(flowId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ["flow-node-stats", flowId],
    queryFn: async () => {
      if (!flowId) return null;

      // Tentar primeiro a versao simples (sem analytics_events)
      const { data, error } = await supabase.rpc("get_flow_node_stats_simple", {
        p_flow_id: flowId,
      });

      if (error) {
        console.error("Erro ao buscar stats do fluxo:", error);
        return null;
      }

      return data as FlowNodeStats;
    },
    enabled: !!flowId && enabled,
    refetchInterval: 60000, // Atualiza a cada 1 min
    staleTime: 30000, // Considera fresh por 30s
  });
}

export type {
  CampaignAnalytics,
  FlowAnalytics,
  PhonePerformance,
  DashboardAnalytics,
  WarmingAnalytics,
  WarmingFunnelItem,
  FlowNodeStats,
};

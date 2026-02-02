import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface DashboardMetrics {
  messages_today: number;
  messages_yesterday: number;
  active_contacts: number;
  active_flows: number;
  delivery_rate: number;
}

interface MessagesPerDay {
  day: string;
  sent: number;
  received: number;
}

interface TopFlow {
  id: string;
  name: string;
  executions: number;
}

interface MessageStatusDistribution {
  name: string;
  value: number;
}

interface RecentActivity {
  type: 'conversation' | 'flow' | 'campaign';
  id: string;
  title: string;
  description: string;
  created_at: string;
}

interface PendingConversation {
  id: string;
  contact_name: string;
  phone_number: string;
  last_message_at: string;
  unread_count: number;
  hours_waiting: number;
}

export function useDashboardMetrics() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['dashboard-metrics', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return null;
      
      const { data, error } = await supabase.rpc('get_dashboard_metrics', { 
        org_id: currentOrg.id 
      });
      
      if (error) throw error;
      return data as unknown as DashboardMetrics;
    },
    enabled: !!currentOrg?.id,
    refetchInterval: 30000,
  });
}

export function useMessagesPerDay() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['messages-per-day', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      
      const { data, error } = await supabase.rpc('get_messages_per_day', { 
        org_id: currentOrg.id 
      });
      
      if (error) throw error;
      return (data || []) as unknown as MessagesPerDay[];
    },
    enabled: !!currentOrg?.id,
    refetchInterval: 60000,
  });
}

export function useTopFlows() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['top-flows', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      
      const { data, error } = await supabase.rpc('get_top_flows', { 
        org_id: currentOrg.id,
        limit_count: 5
      });
      
      if (error) throw error;
      return (data || []) as unknown as TopFlow[];
    },
    enabled: !!currentOrg?.id,
    refetchInterval: 60000,
  });
}

export function useMessageStatusDistribution() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['message-status-distribution', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      
      const { data, error } = await supabase.rpc('get_message_status_distribution', { 
        org_id: currentOrg.id 
      });
      
      if (error) throw error;
      return (data || []) as unknown as MessageStatusDistribution[];
    },
    enabled: !!currentOrg?.id,
    refetchInterval: 60000,
  });
}

export function useRecentActivity() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['recent-activity', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      
      const { data, error } = await supabase.rpc('get_recent_activity', { 
        org_id: currentOrg.id,
        limit_count: 10
      });
      
      if (error) throw error;
      return (data || []) as unknown as RecentActivity[];
    },
    enabled: !!currentOrg?.id,
    refetchInterval: 30000,
  });
}

export function usePendingConversations() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['pending-conversations', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      
      const { data, error } = await supabase.rpc('get_pending_conversations', { 
        org_id: currentOrg.id,
        hours_threshold: 2
      });
      
      if (error) throw error;
      return (data || []) as unknown as PendingConversation[];
    },
    enabled: !!currentOrg?.id,
    refetchInterval: 30000,
  });
}

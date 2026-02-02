import { useQuery } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

export interface SystemLog {
  id: string;
  organization_id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  category: 'campaign' | 'flow' | 'webhook' | 'api' | 'system';
  source: string;
  message: string;
  campaign_id: string | null;
  contact_id: string | null;
  flow_id: string | null;
  request_data: Record<string, any> | null;
  response_data: Record<string, any> | null;
  error_details: Record<string, any> | null;
  duration_ms: number | null;
  created_at: string;
}

export interface LogFilters {
  category?: string;
  level?: string;
  campaign_id?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}

export interface LogStats {
  totalLogs: number;
  errors24h: number;
  byCategory: Record<string, number>;
}

export function useLogs(filters: LogFilters = {}, page: number = 0, limit: number = 50) {
  return useQuery({
    queryKey: ['logs', filters, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));

      if (filters.category && filters.category !== 'all') {
        params.append('category', filters.category);
      }
      if (filters.level && filters.level !== 'all') {
        params.append('level', filters.level);
      }
      if (filters.campaign_id) {
        params.append('campaign_id', filters.campaign_id);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }
      if (filters.start_date) {
        params.append('start_date', filters.start_date);
      }
      if (filters.end_date) {
        params.append('end_date', filters.end_date);
      }

      const response = await fetch(`${API_URL}/api/logs?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Erro ao buscar logs');
      }

      const result = await response.json();
      return {
        data: result.data as SystemLog[],
        count: result.count as number,
        page: result.page as number,
        limit: result.limit as number
      };
    },
  });
}

export function useLogStats() {
  return useQuery({
    queryKey: ['logs-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/logs/stats`);

      if (!response.ok) {
        throw new Error('Erro ao buscar estatísticas');
      }

      return response.json() as Promise<LogStats>;
    },
  });
}

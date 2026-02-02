import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWABA } from '@/contexts/WABAContext';
import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

export interface QueueMetric {
  id: string;
  whatsapp_account_id: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  throughput_per_second: number;
  avg_processing_time_ms: number;
  recorded_at: string;
}

export interface PhoneNumberMetric {
  id: string;
  phone_number_id: string;
  period_start: string;
  period_type: string;
  messages_sent: number;
  messages_delivered: number;
  messages_read: number;
  messages_failed: number;
  avg_delivery_time_ms: number | null;
  max_throughput_achieved: number | null;
  rate_limit_hits: number;
}

export interface QueueStatus {
  latest: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    throughput: number;
    avgProcessingTime: number;
    recordedAt: string;
  } | null;
  history: Array<{
    recorded_at: string;
    throughput: number;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> | null;
  todayStats: {
    totalCompleted: number;
    totalFailed: number;
    avgThroughput: number;
    maxThroughput: number;
  };
}

export interface PhonePerformance {
  summary: {
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
    avgDeliveryTime: number;
    maxThroughput: number;
    rateLimitHits: number;
  };
  history: Array<{
    period_start: string;
    messages_sent: number;
    messages_delivered: number;
    messages_failed: number;
    throughput: number;
  }> | null;
}

// Busca status da fila diretamente do backend (BullMQ)
export function useQueueStatus(wabaId?: string) {
  return useQuery({
    queryKey: ['queue-status', wabaId],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/queue/status`);

      if (!response.ok) {
        throw new Error('Erro ao buscar status da fila');
      }

      const data = await response.json();

      // Parse throughput (pode vir como "80 msgs/sec max" ou número)
      let throughputValue = 0;
      if (typeof data.throughput === 'string') {
        const match = data.throughput.match(/(\d+)/);
        throughputValue = match ? parseInt(match[1], 10) : 0;
      } else if (typeof data.throughput === 'number') {
        throughputValue = data.throughput;
      }

      // Usar throughput real do backend (msgs/segundo)
      const currentThroughput = typeof data.throughput === 'number' ? data.throughput : 0;
      const throughputPerMinute = data.throughputPerMinute || 0;

      // Converter formato do backend para o formato esperado pelo frontend
      const queueStatus: QueueStatus = {
        latest: {
          waiting: data.waiting || 0,
          active: data.active || 0,
          completed: data.completed || 0,
          failed: data.failed || 0,
          delayed: data.delayed || 0,
          throughput: currentThroughput,
          avgProcessingTime: data.avgProcessingTime || 50,
          recordedAt: new Date().toISOString(),
        },
        history: null,
        todayStats: {
          totalCompleted: data.completed || 0,
          totalFailed: data.failed || 0,
          avgThroughput: currentThroughput,
          maxThroughput: data.maxThroughput || 80,
          throughputPerMinute: throughputPerMinute,
        },
      };

      return queueStatus;
    },
    // Sempre habilitado (não depende de wabaId para o backend atual)
    enabled: true,
    refetchInterval: 3000, // Atualiza a cada 3 segundos
  });
}

export function usePhonePerformance(phoneId?: string, periodType: string = 'hour') {
  return useQuery({
    queryKey: ['phone-performance', phoneId, periodType],
    queryFn: async () => {
      if (!phoneId) return null;
      
      const { data, error } = await supabase.rpc('get_phone_performance', {
        phone_id: phoneId,
        period_type_param: periodType,
      });

      if (error) throw error;
      return data as unknown as PhonePerformance;
    },
    enabled: !!phoneId,
  });
}

// Métricas em tempo real do backend (BullMQ)
export function useRealtimeMetrics(wabaId?: string) {
  const [metrics, setMetrics] = useState<Array<{
    timestamp: string;
    throughput: number;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }>>([]);

  const fetchLatest = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/queue/status`);

      if (!response.ok) return;

      const data = await response.json();

      // Usar throughput real do backend
      const currentThroughput = typeof data.throughput === 'number' ? data.throughput : 0;

      setMetrics(prev => {
        const newPoint = {
          timestamp: new Date().toISOString(),
          throughput: currentThroughput,
          waiting: data.waiting || 0,
          active: data.active || 0,
          completed: data.completed || 0,
          failed: data.failed || 0,
        };

        // Keep last 300 points (5 minutes at 1s intervals)
        const updated = [...prev, newPoint];
        return updated.slice(-300);
      });
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchLatest();

    // Poll every second
    const interval = setInterval(fetchLatest, 1000);

    return () => clearInterval(interval);
  }, [fetchLatest]);

  return metrics;
}

export function useQueueMetricsHistory(wabaId?: string, period: 'hour' | 'day' | 'week' = 'hour') {
  const intervalMap = {
    hour: '1 hour',
    day: '24 hours',
    week: '7 days',
  };

  return useQuery({
    queryKey: ['queue-metrics-history', wabaId, period],
    queryFn: async () => {
      if (!wabaId) return [];
      
      const { data, error } = await supabase
        .from('queue_metrics')
        .select('*')
        .eq('whatsapp_account_id', wabaId)
        .gte('recorded_at', new Date(Date.now() - (period === 'hour' ? 3600000 : period === 'day' ? 86400000 : 604800000)).toISOString())
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      return data as QueueMetric[];
    },
    enabled: !!wabaId,
  });
}

export function usePhoneNumbersWithMetrics(wabaId?: string) {
  return useQuery({
    queryKey: ['phone-numbers-with-metrics', wabaId],
    queryFn: async () => {
      if (!wabaId) return [];
      
      const { data: phones, error: phonesError } = await supabase
        .from('phone_numbers')
        .select('*')
        .eq('whatsapp_account_id', wabaId);

      if (phonesError) throw phonesError;

      // Get metrics for each phone
      const phonesWithMetrics = await Promise.all(
        (phones || []).map(async (phone) => {
          const { data: metrics } = await supabase
            .from('phone_number_metrics')
            .select('*')
            .eq('phone_number_id', phone.id)
            .eq('period_type', 'day')
            .gte('period_start', new Date().toISOString().split('T')[0])
            .order('period_start', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...phone,
            todayMetrics: metrics,
          };
        })
      );

      return phonesWithMetrics;
    },
    enabled: !!wabaId,
    refetchInterval: 10000,
  });
}

export function useRunningCampaigns() {
  return useQuery({
    queryKey: ['running-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .in('status', ['running', 'scheduled', 'pending'])
        .order('started_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Converter stats para o formato esperado
      return (data || []).map(c => ({
        ...c,
        stats: c.stats || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      }));
    },
    refetchInterval: 5000,
  });
}

// Controle da fila - Pausar
export function usePauseQueue() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/api/queue/pause`, { method: 'POST' });
      if (!response.ok) throw new Error('Erro ao pausar fila');
      return response.json();
    },
  });
}

// Controle da fila - Retomar
export function useResumeQueue() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/api/queue/resume`, { method: 'POST' });
      if (!response.ok) throw new Error('Erro ao retomar fila');
      return response.json();
    },
  });
}

// Controle da fila - Reprocessar falhos
export function useRetryFailed() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/api/queue/retry-failed`, { method: 'POST' });
      if (!response.ok) throw new Error('Erro ao reprocessar');
      return response.json();
    },
  });
}

// Verificar se fila está pausada
export function useQueuePaused() {
  return useQuery({
    queryKey: ['queue-paused'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/queue/paused`);
      if (!response.ok) throw new Error('Erro ao verificar status');
      return response.json() as Promise<{ paused: boolean }>;
    },
    refetchInterval: 5000,
  });
}

// Info sobre workers
export function useQueueWorkers() {
  return useQuery({
    queryKey: ['queue-workers'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/queue/workers`);
      if (!response.ok) throw new Error('Erro ao buscar workers');
      return response.json() as Promise<{ count: number; workers: Array<{ id: string; name: string }> }>;
    },
    refetchInterval: 10000,
  });
}

// Erros recentes
export interface QueueError {
  id: string;
  message: string;
  error_details: Record<string, unknown>;
  created_at: string;
  contact_id?: string;
  campaign_id?: string;
}

export function useQueueErrors(minutes: number = 10) {
  return useQuery({
    queryKey: ['queue-errors', minutes],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/queue/errors?minutes=${minutes}`);
      if (!response.ok) throw new Error('Erro ao buscar erros');
      return response.json() as Promise<{ errors: QueueError[]; count: number }>;
    },
    refetchInterval: 10000,
  });
}

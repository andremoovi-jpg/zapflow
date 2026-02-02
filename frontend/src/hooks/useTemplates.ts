import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useWABA } from '@/contexts/WABAContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: TemplateButton[];
}

export interface Template {
  id: string;
  whatsapp_account_id: string;
  template_id: string;
  name: string;
  language: string;
  category: string | null;
  status: string | null;
  components: TemplateComponent[];
  example_values: Record<string, string> | null;
  created_at: string | null;
  updated_at: string | null;
  synced_at: string | null;
}

interface TemplateFilters {
  status?: string;
  search?: string;
  wabaId?: string; // Permite override do wabaId selecionado
}

export function useTemplates(filters: TemplateFilters = {}) {
  const { currentOrg } = useOrganization();
  const { selectedWABA } = useWABA();
  const organizationId = currentOrg?.id;

  // Usar wabaId do filtro ou da conta selecionada
  const wabaId = filters.wabaId || selectedWABA?.id;

  return useQuery({
    queryKey: ['templates', organizationId, wabaId, filters],
    queryFn: async () => {
      if (!organizationId || !wabaId) return [];

      let query = supabase
        .from('message_templates')
        .select('*')
        .eq('whatsapp_account_id', wabaId)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status.toUpperCase());
      }

      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(t => ({
        ...t,
        components: (t.components as unknown as TemplateComponent[]) || [],
        example_values: t.example_values as Record<string, string> | null,
      })) as Template[];
    },
    enabled: !!organizationId && !!wabaId,
  });
}

/**
 * Hook que busca templates de todas as WABAs da organizacao
 * Usado no sistema de warming onde precisamos mostrar templates de cada WABA
 */
export function useAllOrganizationTemplates(wabaIds?: string[]) {
  const { currentOrg } = useOrganization();
  const organizationId = currentOrg?.id;

  return useQuery({
    queryKey: ['templates', 'all', organizationId, wabaIds],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('message_templates')
        .select('*, whatsapp_accounts!inner(organization_id)')
        .eq('whatsapp_accounts.organization_id', organizationId)
        .order('created_at', { ascending: false });

      // Se passaram wabaIds especificos, filtrar por eles
      if (wabaIds && wabaIds.length > 0) {
        query = query.in('whatsapp_account_id', wabaIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(t => ({
        ...t,
        components: (t.components as unknown as TemplateComponent[]) || [],
        example_values: t.example_values as Record<string, string> | null,
      })) as Template[];
    },
    enabled: !!organizationId,
  });
}

export function useSyncTemplates() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const { selectedWABA } = useWABA();

  return useMutation({
    mutationFn: async (wabaId?: string) => {
      if (!currentOrg?.id) {
        throw new Error('Organização não selecionada');
      }

      const targetWabaId = wabaId || selectedWABA?.id;
      if (!targetWabaId) {
        throw new Error('Nenhuma conta WhatsApp selecionada');
      }

      // Usar endpoint do backend ao invés da Edge Function
      const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

      const response = await fetch(`${API_URL}/api/templates/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waba_id: targetWabaId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(`Templates sincronizados: ${data?.total || 0} templates`);
    },
    onError: (error: Error) => {
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar templates: ' + error.message);
    },
  });
}

// Helper function to extract variables from template text
export function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  return matches ? [...new Set(matches)] : [];
}

// Helper function to replace variables with values
export function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
  });
  return result;
}

// Get component by type
export function getComponent(components: TemplateComponent[], type: string): TemplateComponent | undefined {
  return components.find(c => c.type === type);
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import type { WhatsAppAccount } from '@/contexts/WABAContext';

export interface CreateWABAData {
  name: string;
  waba_id: string;
  business_manager_id?: string;
  app_id?: string;
  access_token: string;
  app_secret?: string;
  proxy_enabled?: boolean;
  proxy_type?: string;
  proxy_url?: string;
  proxy_username?: string;
  proxy_password?: string;
}

export interface UpdateWABAData extends Partial<CreateWABAData> {
  id: string;
}

export function useWhatsAppAccounts() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['whatsapp-accounts', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WhatsAppAccount[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useWhatsAppAccount(wabaId: string | undefined) {
  return useQuery({
    queryKey: ['whatsapp-account', wabaId],
    queryFn: async () => {
      if (!wabaId) return null;

      const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('id', wabaId)
        .maybeSingle();

      if (error) throw error;
      return data as WhatsAppAccount | null;
    },
    enabled: !!wabaId,
  });
}

export function useCreateWABA() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();

  return useMutation({
    mutationFn: async (data: CreateWABAData) => {
      if (!currentOrg?.id) throw new Error('Organização não selecionada');

      // Usar endpoint de setup automático que:
      // 1. Valida o token com a API do Meta
      // 2. Busca e registra phone numbers
      // 3. Sincroniza templates
      const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

      const response = await fetch(`${API_URL}/api/waba/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: currentOrg.id,
          waba_id: data.waba_id,
          access_token: data.access_token,
          name: data.name,
          // Proxy config
          proxy_enabled: data.proxy_enabled || false,
          proxy_type: data.proxy_type || 'http',
          proxy_url: data.proxy_url || null,
          proxy_username: data.proxy_username || null,
          proxy_password: data.proxy_password || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao configurar conta');
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(`Conta configurada! ${result.phone_numbers} número(s) e ${result.templates} template(s) sincronizados.`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar conta: ' + error.message);
    },
  });
}

export function useUpdateWABA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, access_token, app_secret, proxy_password, ...data }: UpdateWABAData) => {
      const updateData: Record<string, unknown> = { ...data };
      
      if (access_token) {
        updateData.access_token_encrypted = access_token;
      }
      if (app_secret) {
        updateData.app_secret_encrypted = app_secret;
      }
      if (proxy_password) {
        updateData.proxy_password_encrypted = proxy_password;
      }

      const { error } = await supabase
        .from('whatsapp_accounts')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-account', variables.id] });
      toast.success('Conta atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useDeleteWABA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (wabaId: string) => {
      const { error } = await supabase
        .from('whatsapp_accounts')
        .delete()
        .eq('id', wabaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      toast.success('Conta removida!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });
}

export function usePhoneNumbers(wabaId: string | undefined) {
  return useQuery({
    queryKey: ['phone-numbers', wabaId],
    queryFn: async () => {
      if (!wabaId) return [];

      const { data, error } = await supabase
        .from('phone_numbers')
        .select('*')
        .eq('whatsapp_account_id', wabaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!wabaId,
  });
}

export interface PhoneNumberWithWaba {
  id: string;
  phone_number: string;
  phone_number_id: string;
  display_name: string | null;
  whatsapp_account_id: string;
  waba_name: string;
}

export function useAllPhoneNumbers() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['all-phone-numbers', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('phone_numbers')
        .select(`
          id,
          phone_number,
          phone_number_id,
          display_name,
          whatsapp_account_id,
          whatsapp_accounts!inner(id, name, organization_id)
        `)
        .eq('whatsapp_accounts.organization_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        phone_number: item.phone_number,
        phone_number_id: item.phone_number_id,
        display_name: item.display_name,
        whatsapp_account_id: item.whatsapp_account_id,
        waba_name: (item.whatsapp_accounts as any)?.name || 'Desconhecido'
      })) as PhoneNumberWithWaba[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useUpdatePhoneNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; display_name?: string; is_default?: boolean }) => {
      const { error } = await supabase
        .from('phone_numbers')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
      toast.success('Número atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export interface PhoneNumberStats {
  id: string;
  phone_number: string;
  display_name: string | null;
  status: string;
  quality_rating: string;
  quality_label: string;
  messaging_limit: string;
  daily_limit: number;
  messages_sent_today: number;
  remaining_today: number;
  usage_percent: number;
}

export function usePhoneNumbersStats() {
  const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

  return useQuery({
    queryKey: ['phone-numbers-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/phone-numbers/stats`);
      if (!response.ok) throw new Error('Erro ao buscar stats');
      return response.json() as Promise<PhoneNumberStats[]>;
    },
    refetchInterval: 60000, // Atualizar a cada 1 minuto
  });
}

export function useRefreshPhoneInfo() {
  const queryClient = useQueryClient();
  const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

  return useMutation({
    mutationFn: async (phoneId: string) => {
      const response = await fetch(`${API_URL}/api/phone-numbers/${phoneId}/info?refresh=true`);
      if (!response.ok) throw new Error('Erro ao atualizar info');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-numbers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
      toast.success('Informações atualizadas da API do WhatsApp!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export interface SyncWABAStatusResult {
  status: string;
  health_status: string;
  is_restricted: boolean;
  restriction_reason?: string;
  phone_numbers_synced: number;
}

export function useSyncWABAStatus() {
  const queryClient = useQueryClient();
  const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

  return useMutation({
    mutationFn: async (wabaId: string): Promise<SyncWABAStatusResult> => {
      const response = await fetch(`${API_URL}/api/waba/${wabaId}/sync-status`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao sincronizar status');
      }
      return response.json();
    },
    onSuccess: (result, wabaId) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-account', wabaId] });
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['phone-numbers-stats'] });

      if (result.is_restricted) {
        toast.warning(`Conta com restrição: ${result.restriction_reason || 'Verifique no Meta Business'}`, {
          duration: 10000,
        });
      } else {
        toast.success(`Status sincronizado! Status: ${result.status}, Saúde: ${result.health_status}`);
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao sincronizar: ' + error.message);
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface ApiKey {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  permissions: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

export interface CreateApiKeyData {
  name: string;
  permissions: string[];
  expires_at?: string | null;
}

export function useApiKeys() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['api-keys', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ApiKey[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();

  return useMutation({
    mutationFn: async (data: CreateApiKeyData) => {
      if (!currentOrg?.id) throw new Error('Organização não selecionada');

      // Generate API key (in production, use a more secure method)
      const rawKey = `wha_${crypto.randomUUID().replace(/-/g, '')}`;
      const keyPrefix = rawKey.substring(0, 10);
      
      // Simple hash for demo (use proper hashing in production)
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(rawKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: result, error } = await supabase
        .from('api_keys')
        .insert({
          organization_id: currentOrg.id,
          name: data.name,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          permissions: data.permissions,
          expires_at: data.expires_at || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Return the raw key along with the result (only shown once)
      return { ...result, rawKey };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar chave: ' + error.message);
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('Chave revogada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao revogar chave: ' + error.message);
    },
  });
}

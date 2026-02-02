import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';

export interface CustomFieldDefinition {
  id: string;
  organization_id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  required: boolean;
  default_value?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomFieldInput {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  required?: boolean;
  default_value?: string;
  description?: string;
}

export function useCustomFields() {
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['custom-fields', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CustomFieldDefinition[];
    },
    enabled: !!currentOrg?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateCustomFieldInput) => {
      if (!currentOrg?.id) throw new Error('No organization');

      // Normalizar o nome (remover espaços, acentos, deixar lowercase)
      const normalizedName = input.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      const { data, error } = await supabase
        .from('custom_field_definitions')
        .insert({
          organization_id: currentOrg.id,
          name: normalizedName,
          label: input.label,
          type: input.type,
          options: input.options,
          required: input.required || false,
          default_value: input.default_value,
          description: input.description,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast({
        title: 'Campo criado',
        description: 'O campo personalizado foi criado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar campo',
        description: error.message || 'Ocorreu um erro ao criar o campo.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateCustomFieldInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast({
        title: 'Campo atualizado',
        description: 'O campo personalizado foi atualizado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar campo',
        description: error.message || 'Ocorreu um erro ao atualizar o campo.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast({
        title: 'Campo excluído',
        description: 'O campo personalizado foi excluído com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir campo',
        description: error.message || 'Ocorreu um erro ao excluir o campo.',
        variant: 'destructive',
      });
    },
  });

  return {
    fields: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createField: createMutation.mutate,
    updateField: updateMutation.mutate,
    deleteField: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';

export interface Contact {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  conversation_state: string | null;
  last_interaction_at: string | null;
  opted_in: boolean;
  created_at: string;
  organization_id: string;
}

export interface ContactFilters {
  search?: string;
  tags?: string[];
  status?: 'all' | 'opted_in' | 'opted_out';
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CreateContactData {
  phone_number: string;
  name?: string;
  email?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  opted_in?: boolean;
}

const PAGE_SIZE = 20;

export function useContacts(filters: ContactFilters = {}, page: number = 0) {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['contacts', currentOrg?.id, filters, page],
    queryFn: async () => {
      if (!currentOrg?.id) return { data: [], count: 0 };

      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`);
      }

      if (filters.tags?.length) {
        query = query.overlaps('tags', filters.tags);
      }

      if (filters.status === 'opted_in') {
        query = query.eq('opted_in', true);
      } else if (filters.status === 'opted_out') {
        query = query.eq('opted_in', false);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return { data: data as Contact[], count: count ?? 0 };
    },
    enabled: !!currentOrg?.id,
  });
}

export function useContact(contactId: string | undefined) {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      if (!contactId || !currentOrg?.id) return null;

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('organization_id', currentOrg.id)
        .single();

      if (error) throw error;

      return data as Contact;
    },
    enabled: !!contactId && !!currentOrg?.id,
  });
}

export function useContactStats() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['contact-stats', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return null;

      const { count: total } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrg.id);

      const { count: optedIn } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrg.id)
        .eq('opted_in', true);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: recentlyActive } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrg.id)
        .gte('last_interaction_at', sevenDaysAgo.toISOString());

      const { count: newContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrg.id)
        .gte('created_at', sevenDaysAgo.toISOString());

      return {
        total: total ?? 0,
        optedIn: optedIn ?? 0,
        recentlyActive: recentlyActive ?? 0,
        newContacts: newContacts ?? 0,
      };
    },
    enabled: !!currentOrg?.id,
  });
}

export function useAllTags() {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: ['contact-tags', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('contacts')
        .select('tags')
        .eq('organization_id', currentOrg.id);

      if (error) throw error;

      const allTags = new Set<string>();
      data?.forEach((contact) => {
        contact.tags?.forEach((tag: string) => allTags.add(tag));
      });

      return Array.from(allTags).sort();
    },
    enabled: !!currentOrg?.id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateContactData) => {
      if (!currentOrg?.id) throw new Error('No organization selected');

      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          phone_number: data.phone_number,
          name: data.name,
          email: data.email,
          organization_id: currentOrg.id,
          tags: data.tags ?? [],
          custom_fields: (data.custom_fields ?? {}) as Record<string, string>,
          opted_in: data.opted_in ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-stats'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
      toast({
        title: 'Contato criado',
        description: 'O contato foi adicionado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar contato',
        description: error.message.includes('duplicate')
          ? 'Este telefone já está cadastrado.'
          : error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string | null; email?: string | null; tags?: string[]; custom_fields?: Record<string, string>; opted_in?: boolean }) => {
      const { data: contact, error } = await supabase
        .from('contacts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return contact;
    },
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', contact.id] });
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
      toast({
        title: 'Contato atualizado',
        description: 'As alterações foram salvas.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar contato',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteContacts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-stats'] });
      toast({
        title: ids.length === 1 ? 'Contato excluído' : 'Contatos excluídos',
        description: `${ids.length} contato(s) removido(s) com sucesso.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir contato(s)',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useBulkUpdateTags() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      ids,
      tags,
      action,
    }: {
      ids: string[];
      tags: string[];
      action: 'add' | 'remove';
    }) => {
      // Get current contacts
      const { data: contacts, error: fetchError } = await supabase
        .from('contacts')
        .select('id, tags')
        .in('id', ids);

      if (fetchError) throw fetchError;

      // Update each contact
      for (const contact of contacts || []) {
        const currentTags = contact.tags || [];
        let newTags: string[];

        if (action === 'add') {
          newTags = [...new Set([...currentTags, ...tags])];
        } else {
          newTags = currentTags.filter((t: string) => !tags.includes(t));
        }

        const { error } = await supabase
          .from('contacts')
          .update({ tags: newTags })
          .eq('id', contact.id);

        if (error) throw error;
      }
    },
    onSuccess: (_, { ids, action }) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
      toast({
        title: action === 'add' ? 'Tags adicionadas' : 'Tags removidas',
        description: `Tags atualizadas em ${ids.length} contato(s).`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar tags',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StopFlowsResult {
  flowsCancelled: number;
  warmingCancelled: number;
  tagAdded: boolean;
}

export function useStopContactFlows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string): Promise<StopFlowsResult> => {
      let flowsCancelled = 0;
      let warmingCancelled = 0;

      // 1. Cancelar flow_executions pendentes/em andamento
      const { data: flowExecs } = await supabase
        .from('flow_executions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('contact_id', contactId)
        .in('status', ['running', 'waiting', 'pending'])
        .select();

      flowsCancelled = flowExecs?.length || 0;

      // 2. Cancelar warming_contact_history
      const { data: warmingHistory } = await supabase
        .from('warming_contact_history')
        .update({
          status: 'cancelled'
        })
        .eq('contact_id', contactId)
        .eq('status', 'in_progress')
        .select();

      if (warmingHistory && warmingHistory.length > 0) {
        warmingCancelled = warmingHistory.length;

        // 3. Cancelar warming_message_executions pendentes
        for (const history of warmingHistory) {
          await supabase
            .from('warming_message_executions')
            .update({
              status: 'cancelled',
              skip_reason: 'optout'
            })
            .eq('warming_contact_history_id', history.id)
            .in('status', ['pending', 'scheduled']);
        }
      }

      // 4. Adicionar tag "optout" ao contato
      const { data: contact } = await supabase
        .from('contacts')
        .select('tags')
        .eq('id', contactId)
        .single();

      const currentTags = (contact?.tags as string[]) || [];
      if (!currentTags.includes('optout')) {
        await supabase
          .from('contacts')
          .update({
            tags: [...currentTags, 'optout']
          })
          .eq('id', contactId);
      }

      return {
        flowsCancelled,
        warmingCancelled,
        tagAdded: !currentTags.includes('optout')
      };
    },
    onSuccess: (result) => {
      const messages = [];
      if (result.flowsCancelled > 0) {
        messages.push(`${result.flowsCancelled} fluxo(s) cancelado(s)`);
      }
      if (result.warmingCancelled > 0) {
        messages.push(`${result.warmingCancelled} aquecimento(s) cancelado(s)`);
      }
      if (result.tagAdded) {
        messages.push('Tag "optout" adicionada');
      }

      if (messages.length > 0) {
        toast.success('Fluxos parados', {
          description: messages.join(', ')
        });
      } else {
        toast.info('Nenhum fluxo ativo encontrado');
      }

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      console.error('Erro ao parar fluxos:', error);
      toast.error('Erro ao parar fluxos');
    }
  });
}

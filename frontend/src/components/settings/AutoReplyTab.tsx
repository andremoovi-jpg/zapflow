import { useState, useEffect } from 'react';
import { Save, MessageSquare, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

interface Settings {
  id?: string;
  auto_reply_enabled: boolean;
  auto_reply_message: string;
}

export function AutoReplyTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/settings`);
      if (!response.ok) throw new Error('Erro ao buscar configurações');
      return response.json() as Promise<Settings>;
    },
  });

  useEffect(() => {
    if (settings) {
      setEnabled(settings.auto_reply_enabled);
      setMessage(settings.auto_reply_message || '');
    }
  }, [settings]);

  useEffect(() => {
    if (settings) {
      const changed =
        enabled !== settings.auto_reply_enabled ||
        message !== (settings.auto_reply_message || '');
      setHasChanges(changed);
    }
  }, [enabled, message, settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: { auto_reply_enabled: boolean; auto_reply_message: string }) => {
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Erro ao salvar');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({
        title: 'Configurações salvas',
        description: 'A resposta automática foi atualizada com sucesso.',
      });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Ocorreu um erro ao salvar as configurações.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      auto_reply_enabled: enabled,
      auto_reply_message: message,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Resposta Automática
              </CardTitle>
              <CardDescription>
                Configure a mensagem enviada automaticamente para novos contatos
              </CardDescription>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              placeholder="Digite a mensagem de resposta automática..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              disabled={!enabled}
              className={!enabled ? 'opacity-50' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Esta mensagem será enviada automaticamente quando um novo contato enviar a primeira mensagem.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {enabled ? (
                <span className="text-green-600 font-medium">Ativo</span>
              ) : (
                <span className="text-red-600 font-medium">Desativado</span>
              )}
            </div>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prévia da Mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-[#e5ddd5] rounded-lg p-4">
            <div className="bg-white rounded-lg p-3 max-w-[80%] shadow-sm">
              <p className="text-sm whitespace-pre-wrap">
                {message || 'Nenhuma mensagem configurada'}
              </p>
              <p className="text-[10px] text-muted-foreground text-right mt-1">
                Agora
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

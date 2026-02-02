import { useState, useEffect } from 'react';
import { Send, Bell, Loader2, CheckCircle2, AlertCircle, Webhook } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || '';

export function TelegramTab() {
  const { currentOrg } = useOrganization();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settingUpWebhook, setSettingUpWebhook] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Carregar configurações atuais
  useEffect(() => {
    async function loadSettings() {
      if (!currentOrg?.id) return;

      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('telegram_bot_token, telegram_chat_id, telegram_notifications_enabled')
          .eq('id', currentOrg.id)
          .single();

        if (data) {
          setBotToken(data.telegram_bot_token || '');
          setChatId(data.telegram_chat_id || '');
          setEnabled(data.telegram_notifications_enabled || false);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      } finally {
        setLoadingSettings(false);
      }
    }

    loadSettings();
  }, [currentOrg?.id]);

  const handleSave = async () => {
    if (!currentOrg?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: currentOrg.id,
          bot_token: botToken || null,
          chat_id: chatId || null,
          enabled: enabled
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Configurações salvas com sucesso!');
      } else {
        toast.error(data.error || 'Erro ao salvar configurações');
      }
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!botToken || !chatId) {
      toast.error('Preencha o Bot Token e Chat ID');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/telegram/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: botToken,
          chat_id: chatId
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Mensagem de teste enviada! Verifique seu Telegram.');
      } else {
        toast.error(data.error || 'Erro ao enviar teste');
      }
    } catch (error) {
      toast.error('Erro ao enviar teste');
    } finally {
      setTesting(false);
    }
  };

  const handleSetupWebhook = async () => {
    if (!currentOrg?.id || !botToken) {
      toast.error('Configure o Bot Token primeiro');
      return;
    }

    setSettingUpWebhook(true);
    try {
      const response = await fetch(`${API_URL}/api/telegram/setup-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: currentOrg.id
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Comando /status ativado! Teste no Telegram.');
      } else {
        toast.error(data.error || 'Erro ao configurar webhook');
      }
    } catch (error) {
      toast.error('Erro ao configurar webhook');
    } finally {
      setSettingUpWebhook(false);
    }
  };

  if (loadingSettings) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Notificações do Telegram
          </CardTitle>
          <CardDescription>
            Receba alertas quando suas WABAs tiverem problemas de qualidade ou restrições
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Ativar Notificações</p>
                <p className="text-sm text-muted-foreground">
                  Receba alertas a cada 2 horas se houver problemas
                </p>
              </div>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botToken">Bot Token</Label>
              <Input
                id="botToken"
                type="password"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Crie um bot com o @BotFather e copie o token
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chatId">Chat ID</Label>
              <Input
                id="chatId"
                placeholder="-1001234567890 ou 123456789"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use @userinfobot para descobrir seu Chat ID ou ID do grupo
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Configurações
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !botToken || !chatId}
            >
              {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Testar Conexão
            </Button>
            <Button
              variant="secondary"
              onClick={handleSetupWebhook}
              disabled={settingUpWebhook || !botToken}
            >
              {settingUpWebhook && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Webhook className="h-4 w-4 mr-2" />
              Ativar /status
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Comando /status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Após salvar as configurações e clicar em "Ativar /status", você pode enviar o comando <code className="bg-muted px-1 py-0.5 rounded">/status</code> no Telegram para receber um relatório atualizado das suas WABAs a qualquer momento.
          </p>
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium mb-1">Exemplo de uso:</p>
            <p className="text-muted-foreground">No chat do bot ou grupo, envie: <code className="bg-background px-1 py-0.5 rounded">/status</code></p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como configurar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium">Criar um Bot</p>
                <p className="text-sm text-muted-foreground">
                  Abra o Telegram, busque por @BotFather e envie /newbot. Siga as instruções e copie o token.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <p className="font-medium">Obter o Chat ID</p>
                <p className="text-sm text-muted-foreground">
                  Busque @userinfobot e envie qualquer mensagem para receber seu ID. Para grupos, adicione o bot ao grupo e envie /start.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <p className="font-medium">Testar</p>
                <p className="text-sm text-muted-foreground">
                  Cole as credenciais acima e clique em "Testar Conexão" para verificar se está funcionando.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertas Monitorados</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Qualidade RED (Baixa)
            </li>
            <li className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              Conta bloqueada ou restrita
            </li>
            <li className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Status desconectado
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Verificação a cada 2 horas
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

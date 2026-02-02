import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, TestTube2, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateWABA, useSyncWABAStatus } from '@/hooks/useWhatsAppAccounts';
import type { WhatsAppAccount } from '@/contexts/WABAContext';
import { toast } from 'sonner';

interface ConfigureWABAModalProps {
  waba: WhatsAppAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfigureWABAModal({ waba, open, onOpenChange }: ConfigureWABAModalProps) {
  const updateWABA = useUpdateWABA();
  const syncStatus = useSyncWABAStatus();
  const [name, setName] = useState(waba.name);
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [proxyEnabled, setProxyEnabled] = useState(waba.proxy_enabled || false);
  const [proxyType, setProxyType] = useState(waba.proxy_type || 'http');
  const [proxyUrl, setProxyUrl] = useState(waba.proxy_url || '');
  const [proxyUsername, setProxyUsername] = useState(waba.proxy_username || '');
  const [proxyPassword, setProxyPassword] = useState('');
  const [rateLimitPerSecond, setRateLimitPerSecond] = useState(waba.rate_limit_per_second);
  const [rateLimitPerDay, setRateLimitPerDay] = useState(waba.rate_limit_per_day);

  // Estado para teste de proxy
  const [testingProxy, setTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState<{ success: boolean; message: string; ip?: string } | null>(null);

  const handleSaveGeneral = async () => {
    await updateWABA.mutateAsync({ id: waba.id, name });
  };

  const handleSaveCredentials = async () => {
    await updateWABA.mutateAsync({
      id: waba.id,
      access_token: accessToken || undefined,
      app_secret: appSecret || undefined,
    });
    setAccessToken('');
    setAppSecret('');
  };

  const handleSaveRateLimits = async () => {
    await updateWABA.mutateAsync({
      id: waba.id,
      // Note: rate limits would need to be added to the update type
    });
  };

  const handleSaveProxy = async () => {
    try {
      await updateWABA.mutateAsync({
        id: waba.id,
        proxy_enabled: proxyEnabled,
        proxy_type: proxyType,
        proxy_url: proxyUrl || undefined,
        proxy_username: proxyUsername || undefined,
        proxy_password: proxyPassword || undefined,
      });
      setProxyPassword(''); // Limpar senha após salvar
    } catch (error) {
      console.error('Erro ao salvar proxy:', error);
    }
  };

  const handleTestProxy = async () => {
    setTestingProxy(true);
    setProxyTestResult(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

      const response = await fetch(`${API_URL}/api/proxy/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxy_type: proxyType,
          proxy_url: proxyUrl,
          proxy_username: proxyUsername || undefined,
          proxy_password: proxyPassword || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setProxyTestResult({
          success: true,
          message: 'Proxy funcionando!',
          ip: result.external_ip
        });
        toast.success(`Proxy OK! IP externo: ${result.external_ip}`);
      } else {
        setProxyTestResult({
          success: false,
          message: result.error || 'Falha na conexão'
        });
        toast.error(`Erro: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      setProxyTestResult({
        success: false,
        message: errorMsg
      });
      toast.error(`Erro ao testar proxy: ${errorMsg}`);
    } finally {
      setTestingProxy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar: {waba.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="credentials">Credenciais</TabsTrigger>
            <TabsTrigger value="proxy">Proxy</TabsTrigger>
            <TabsTrigger value="health">Saúde</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Conta</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>WABA ID</Label>
              <Input value={waba.waba_id} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Status Atual</Label>
              <div className="flex gap-2">
                <Input value={waba.status} disabled className={`bg-muted capitalize flex-1 ${
                  waba.status === 'suspended' ? 'text-red-600 font-semibold' :
                  waba.status === 'degraded' ? 'text-yellow-600 font-semibold' :
                  waba.status === 'active' ? 'text-green-600' : ''
                }`} />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => syncStatus.mutate(waba.id)}
                  disabled={syncStatus.isPending}
                  title="Sincronizar status da Meta"
                >
                  {syncStatus.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Clique no botão para sincronizar o status diretamente da API da Meta
              </p>
            </div>

            {/* Alerta se conta estiver suspensa/degradada */}
            {(waba.status === 'suspended' || waba.status === 'degraded') && (
              <div className={`p-4 rounded-lg flex items-start gap-3 ${
                waba.status === 'suspended'
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
              }`}>
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {waba.status === 'suspended' ? 'Conta Restrita pela Meta' : 'Conta com Qualidade Degradada'}
                  </p>
                  <p className="text-sm mt-1">
                    {waba.status === 'suspended'
                      ? 'Esta conta recebeu uma restrição do WhatsApp. Verifique o Meta Business Suite para mais detalhes e resolver o problema.'
                      : 'A qualidade desta conta está abaixo do esperado. Verifique as mensagens sendo enviadas e reduza o volume se necessário.'}
                  </p>
                  <a
                    href="https://business.facebook.com/settings/whatsapp-business-accounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline mt-2 inline-block hover:no-underline"
                  >
                    Abrir Meta Business Suite →
                  </a>
                </div>
              </div>
            )}

            {waba.last_error_message && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <strong>Último erro:</strong> {waba.last_error_message}
              </div>
            )}
            <Button onClick={handleSaveGeneral} disabled={updateWABA.isPending}>
              {updateWABA.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </TabsContent>

          <TabsContent value="credentials" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="access_token">Novo Access Token</Label>
              <Input
                id="access_token"
                type="password"
                placeholder="Deixe vazio para manter o atual"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app_secret">Novo App Secret</Label>
              <Input
                id="app_secret"
                type="password"
                placeholder="Deixe vazio para manter o atual"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveCredentials} disabled={updateWABA.isPending || (!accessToken && !appSecret)}>
                {updateWABA.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Atualizar Credenciais
              </Button>
              <Button variant="outline">Testar Credenciais</Button>
            </div>
          </TabsContent>

          <TabsContent value="proxy" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Usar proxy dedicado</p>
                <p className="text-sm text-muted-foreground">
                  Roteie as requisições através de um proxy
                </p>
              </div>
              <Switch
                checked={proxyEnabled}
                onCheckedChange={setProxyEnabled}
              />
            </div>
            {proxyEnabled && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Tipo de Proxy</Label>
                  <Select value={proxyType} onValueChange={setProxyType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="https">HTTPS</SelectItem>
                      <SelectItem value="socks4">SOCKS4</SelectItem>
                      <SelectItem value="socks5">SOCKS5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>URL do Proxy *</Label>
                  <Input
                    placeholder="http://proxy.example.com:8080"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Exemplo: http://proxy.exemplo.com:8080 ou socks5://proxy.exemplo.com:1080
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Usuário</Label>
                    <Input
                      placeholder="Opcional"
                      value={proxyUsername}
                      onChange={(e) => setProxyUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input
                      type="password"
                      placeholder={waba.proxy_username ? '••••••••' : 'Opcional'}
                      value={proxyPassword}
                      onChange={(e) => setProxyPassword(e.target.value)}
                    />
                  </div>
                </div>

                {/* Resultado do teste */}
                {proxyTestResult && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 ${
                    proxyTestResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  }`}>
                    {proxyTestResult.success ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                    <div>
                      <p className="font-medium">{proxyTestResult.message}</p>
                      {proxyTestResult.ip && (
                        <p className="text-sm opacity-80">IP externo: {proxyTestResult.ip}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Botão de teste */}
                <Button
                  variant="outline"
                  onClick={handleTestProxy}
                  disabled={testingProxy || !proxyUrl}
                  className="w-full"
                >
                  {testingProxy ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube2 className="h-4 w-4 mr-2" />
                  )}
                  Testar Conexão do Proxy
                </Button>
              </div>
            )}
            <Button
              onClick={handleSaveProxy}
              disabled={updateWABA.isPending || (proxyEnabled && !proxyUrl)}
              className="w-full"
            >
              {updateWABA.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Salvar Configurações de Proxy
            </Button>
          </TabsContent>

          <TabsContent value="health" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-lg font-semibold capitalize">{waba.health_status}</p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Último Check</p>
                <p className="text-lg font-semibold">
                  {waba.last_health_check_at
                    ? new Date(waba.last_health_check_at).toLocaleString('pt-BR')
                    : 'Nunca'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rate Limit por Segundo</Label>
              <Input
                type="number"
                value={rateLimitPerSecond}
                onChange={(e) => setRateLimitPerSecond(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rate Limit Diário</Label>
              <Input
                type="number"
                value={rateLimitPerDay}
                onChange={(e) => setRateLimitPerDay(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagens Enviadas Hoje</Label>
              <Input value={waba.messages_sent_today} disabled className="bg-muted" />
            </div>
            <Button variant="outline" className="w-full">
              Executar Health Check
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

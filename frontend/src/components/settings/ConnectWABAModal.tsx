import { useState } from 'react';
import { Check, Copy, Loader2, CheckCircle, XCircle, TestTube2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateWABA } from '@/hooks/useWhatsAppAccounts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ConnectWABAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  { id: 1, title: 'Credenciais da Meta' },
  { id: 2, title: 'Proxy (Opcional)' },
  { id: 3, title: 'Webhook' },
  { id: 4, title: 'Teste' },
];

export function ConnectWABAModal({ open, onOpenChange }: ConnectWABAModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; businessName?: string; error?: string } | null>(null);
  const [testingProxy, setTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState<{ success: boolean; message: string; ip?: string } | null>(null);
  const createWABA = useCreateWABA();
  const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    waba_id: '',
    business_manager_id: '',
    app_id: '',
    access_token: '',
    app_secret: '',
    proxy_enabled: false,
    proxy_type: 'http',
    proxy_url: '',
    proxy_username: '',
    proxy_password: '',
  });

  // Generated webhook info (would come from backend in production)
  const webhookUrl = `https://api.example.com/webhooks/whatsapp/${formData.waba_id || '{waba_id}'}`;
  const verifyToken = 'generated_token_' + Math.random().toString(36).substring(7);

  // Sanitize tokens to remove invisible Unicode characters (often from copy/paste)
  const sanitizeToken = (value: string): string => {
    // Remove all non-ASCII characters (keeps only chars 0-127)
    // This removes line separators (U+2028), BOM, non-breaking spaces, etc.
    return value.replace(/[^\x00-\x7F]/g, '').trim();
  };

  const updateFormData = (key: string, value: string | boolean) => {
    // Sanitize tokens and IDs to remove invisible Unicode characters
    if (typeof value === 'string' && ['access_token', 'app_secret', 'waba_id', 'app_id', 'business_manager_id'].includes(key)) {
      value = sanitizeToken(value);
    }
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleTestProxy = async () => {
    setTestingProxy(true);
    setProxyTestResult(null);

    try {
      const response = await fetch(`${API_URL}/api/proxy/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxy_type: formData.proxy_type,
          proxy_url: formData.proxy_url,
          proxy_username: formData.proxy_username || undefined,
          proxy_password: formData.proxy_password || undefined,
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

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Testar conexão real com a API da Meta
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${formData.waba_id}?fields=id,name&access_token=${formData.access_token}`
      );
      const data = await response.json();

      if (data.error) {
        setTestResult({
          success: false,
          error: data.error.message || 'Erro ao conectar com a Meta API'
        });
      } else {
        setTestResult({
          success: true,
          businessName: data.name || 'Conta verificada'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro de conexão'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      await createWABA.mutateAsync(formData);
      onOpenChange(false);
      // Reset form
      setCurrentStep(1);
      setFormData({
        name: '',
        waba_id: '',
        business_manager_id: '',
        app_id: '',
        access_token: '',
        app_secret: '',
        proxy_enabled: false,
        proxy_type: 'http',
        proxy_url: '',
        proxy_username: '',
        proxy_password: '',
      });
      setTestResult(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.waba_id && formData.access_token;
      case 2:
        return !formData.proxy_enabled || (formData.proxy_url);
      case 3:
        return true;
      case 4:
        return testResult?.success;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Conta *</Label>
              <Input
                id="name"
                placeholder="Identificação interna (ex: Principal, Suporte)"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="waba_id">WABA ID *</Label>
                <Input
                  id="waba_id"
                  placeholder="1234567890123456"
                  value={formData.waba_id}
                  onChange={(e) => updateFormData('waba_id', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_manager_id">Business Manager ID</Label>
                <Input
                  id="business_manager_id"
                  placeholder="9876543210987654"
                  value={formData.business_manager_id}
                  onChange={(e) => updateFormData('business_manager_id', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="app_id">App ID</Label>
              <Input
                id="app_id"
                placeholder="ID do aplicativo Meta"
                value={formData.app_id}
                onChange={(e) => updateFormData('app_id', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access_token">Access Token *</Label>
              <Input
                id="access_token"
                type="password"
                placeholder="Token de acesso permanente"
                value={formData.access_token}
                onChange={(e) => updateFormData('access_token', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app_secret">App Secret</Label>
              <Input
                id="app_secret"
                type="password"
                placeholder="Segredo do aplicativo"
                value={formData.app_secret}
                onChange={(e) => updateFormData('app_secret', e.target.value)}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Usar proxy dedicado</p>
                <p className="text-sm text-muted-foreground">
                  Roteie as requisições através de um proxy
                </p>
              </div>
              <Switch
                checked={formData.proxy_enabled}
                onCheckedChange={(checked) => updateFormData('proxy_enabled', checked)}
              />
            </div>

            {formData.proxy_enabled && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Tipo de Proxy</Label>
                  <Select
                    value={formData.proxy_type}
                    onValueChange={(v) => updateFormData('proxy_type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="https">HTTPS</SelectItem>
                      <SelectItem value="socks5">SOCKS5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proxy_url">URL do Proxy *</Label>
                  <Input
                    id="proxy_url"
                    placeholder="http://proxy.example.com:8080"
                    value={formData.proxy_url}
                    onChange={(e) => updateFormData('proxy_url', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="proxy_username">Usuário</Label>
                    <Input
                      id="proxy_username"
                      placeholder="Opcional"
                      value={formData.proxy_username}
                      onChange={(e) => updateFormData('proxy_username', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proxy_password">Senha</Label>
                    <Input
                      id="proxy_password"
                      type="password"
                      placeholder="Opcional"
                      value={formData.proxy_password}
                      onChange={(e) => updateFormData('proxy_password', e.target.value)}
                    />
                  </div>
                </div>

                {/* Resultado do teste de proxy */}
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

                <Button
                  variant="outline"
                  onClick={handleTestProxy}
                  disabled={testingProxy || !formData.proxy_url}
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
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border bg-muted/50">
              <p className="text-sm font-medium mb-3">
                Configure este webhook na sua conta Meta Business:
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">URL do Webhook</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={() => handleCopy(webhookUrl, 'URL')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Verify Token</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={verifyToken} className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={() => handleCopy(verifyToken, 'Token')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Instruções:</strong></p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Acesse o Meta Business Suite</li>
                <li>Vá para Configurações → Webhooks</li>
                <li>Cole a URL e o Token acima</li>
                <li>Selecione os campos: messages, message_echoes, message_deliveries</li>
                <li>Clique em Verificar e Salvar</li>
              </ol>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Clique no botão abaixo para verificar a conexão com a API da Meta
              </p>
              <Button
                onClick={handleTestConnection}
                disabled={testing}
                size="lg"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Verificar Conexão'
                )}
              </Button>
            </div>

            {testResult && (
              <div className={cn(
                'p-4 rounded-lg',
                testResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              )}>
                {testResult.success ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">Conexão bem-sucedida!</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Negócio: {testResult.businessName}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-800 dark:text-red-200">
                    <p className="font-medium">Falha na conexão</p>
                    <p className="text-sm text-red-600 dark:text-red-400">{testResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conectar Conta WhatsApp</DialogTitle>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                currentStep >= step.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
              </div>
              {index < steps.length - 1 && (
                <div className={cn(
                  'h-0.5 w-8 mx-1',
                  currentStep > step.id ? 'bg-primary' : 'bg-muted'
                )} />
              )}
            </div>
          ))}
        </div>

        <div className="mb-2">
          <p className="font-medium">{steps[currentStep - 1].title}</p>
        </div>

        {renderStepContent()}

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : onOpenChange(false)}
          >
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {currentStep < 4 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
            >
              Próximo
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={!testResult?.success || createWABA.isPending}
            >
              {createWABA.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Conta'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

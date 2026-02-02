import { Node } from 'reactflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus, Trash2, Copy, ExternalLink, Loader2, Upload, Image, Video, FileText } from 'lucide-react';
import { NodeConfig } from '@/hooks/useFlows';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { useCustomFields } from '@/hooks/useCustomFields';
import { WHATSAPP_LIMITS, getCharCounterProps } from '@/lib/whatsappLimits';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

// Componente auxiliar para contador de caracteres
function CharCounter({ value, limit }: { value: string; limit: number }) {
  const { text, className } = getCharCounterProps(value || '', limit);
  return <span className={cn('text-xs', className)}>{text}</span>;
}

const API_URL = import.meta.env.VITE_API_URL || 'https://api.publipropaganda.shop';

interface NodeConfigPanelProps {
  node: Node<{ label: string; type: string; config: NodeConfig }> | null;
  onClose: () => void;
  onUpdate: (nodeId: string, config: Partial<NodeConfig>) => void;
  onDelete: (nodeId: string) => void;
}

export function NodeConfigPanel({ node, onClose, onUpdate, onDelete }: NodeConfigPanelProps) {
  const [uploading, setUploading] = useState(false);

  // Fetch custom fields from the organization
  const { fields: customFields } = useCustomFields();

  // Upload file to Supabase Storage
  const uploadHeaderMedia = async (file: File, mediaType: 'image' | 'video' | 'document') => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `template-headers/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('campaign-assets')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('campaign-assets')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Erro no upload:', error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Fetch WhatsApp accounts (WABAs)
  const { data: wabasData } = useQuery({
    queryKey: ['whatsapp-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('id, name, waba_id')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const wabas = wabasData || [];

  // Fetch templates from database filtered by WABA
  const selectedWabaId = node?.data?.config?.wabaId;
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates-db', selectedWabaId],
    queryFn: async () => {
      let query = supabase
        .from('message_templates')
        .select('*')
        .eq('status', 'APPROVED')
        .order('name');

      if (selectedWabaId) {
        query = query.eq('whatsapp_account_id', selectedWabaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const templates = templatesData || [];

  if (!node) return null;

  const { type, config, label } = node.data;

  const updateConfig = (updates: Partial<NodeConfig>) => {
    onUpdate(node.id, { ...config, ...updates });
  };

  const renderConfig = () => {
    switch (type) {
      case 'trigger_keyword':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Palavras-chave</Label>
              <Input
                placeholder="ex: oi, olá, bom dia"
                value={config.keywords?.join(', ') || ''}
                onChange={(e) => updateConfig({ keywords: e.target.value.split(',').map(k => k.trim()) })}
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Correspondência exata</Label>
              <Switch
                checked={config.exactMatch || false}
                onCheckedChange={(checked) => updateConfig({ exactMatch: checked })}
              />
            </div>
          </div>
        );

      case 'trigger_webhook':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={config.webhookUrl || 'Será gerada ao salvar'}
                  className="flex-1 text-xs"
                />
                <Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(config.webhookUrl || '')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Envie dados para esta URL para disparar o fluxo
              </p>
            </div>
          </div>
        );

      case 'action_send_text': {
        const defaultVars = ['{{nome}}', '{{telefone}}', '{{email}}'];
        const customVars = customFields.map(f => `{{${f.name}}}`);

        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <div className="relative">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={config.message || ''}
                  onChange={(e) => updateConfig({ message: e.target.value.slice(0, WHATSAPP_LIMITS.TEXT_MESSAGE) })}
                  rows={4}
                  maxLength={WHATSAPP_LIMITS.TEXT_MESSAGE}
                />
                <div className="absolute bottom-1 right-2">
                  <CharCounter value={config.message || ''} limit={WHATSAPP_LIMITS.TEXT_MESSAGE} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Variáveis do contato</Label>
              <div className="flex flex-wrap gap-1">
                {defaultVars.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80"
                    onClick={() => updateConfig({ message: (config.message || '') + ' ' + v })}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {customFields.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Campos personalizados</Label>
                <div className="flex flex-wrap gap-1">
                  {customVars.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                      onClick={() => updateConfig({ message: (config.message || '') + ' ' + v })}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'action_send_template': {
        const selectedTemplate = templates.find((t: any) => t.name === config.templateName);

        // Extrair variáveis do template (formato {{1}}, {{2}}, etc.)
        const extractVariables = (template: any) => {
          if (!template?.components) return [];
          const variables: { index: number; component: string }[] = [];

          template.components.forEach((comp: any) => {
            if (comp.type === 'HEADER' && comp.format === 'TEXT' && comp.text) {
              const matches = comp.text.match(/\{\{(\d+)\}\}/g) || [];
              matches.forEach((m: string) => {
                const idx = parseInt(m.replace(/\D/g, ''));
                variables.push({ index: idx, component: 'header' });
              });
            }
            if (comp.type === 'BODY' && comp.text) {
              const matches = comp.text.match(/\{\{(\d+)\}\}/g) || [];
              matches.forEach((m: string) => {
                const idx = parseInt(m.replace(/\D/g, ''));
                variables.push({ index: idx, component: 'body' });
              });
            }
          });

          return variables.sort((a, b) => a.index - b.index);
        };

        // Extrair botões do template
        const extractButtons = (template: any) => {
          if (!template?.components) return [];
          const buttons: { id: string; text: string; type: string }[] = [];

          template.components.forEach((comp: any) => {
            if (comp.type === 'BUTTONS') {
              comp.buttons?.forEach((btn: any, idx: number) => {
                if (btn.type === 'QUICK_REPLY') {
                  buttons.push({
                    id: `btn_${idx}`,
                    text: btn.text,
                    type: 'quick_reply'
                  });
                }
              });
            }
          });

          return buttons;
        };

        const templateVariables = selectedTemplate ? extractVariables(selectedTemplate) : [];
        const templateButtons = selectedTemplate ? extractButtons(selectedTemplate) : [];
        const templateVars = config.templateVariables || {};

        return (
          <div className="space-y-4">
            {/* Seletor de WABA */}
            <div className="space-y-2">
              <Label>Conta WhatsApp (WABA)</Label>
              <Select
                value={config.wabaId || ''}
                onValueChange={(value) => {
                  updateConfig({
                    wabaId: value,
                    templateName: undefined,
                    templateVariables: {},
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a WABA" />
                </SelectTrigger>
                <SelectContent>
                  {wabas.map((waba: any) => (
                    <SelectItem key={waba.id} value={waba.id}>
                      {waba.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecione de qual conta os templates serão carregados
              </p>
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              {!config.wabaId ? (
                <p className="text-sm text-muted-foreground">
                  Selecione uma WABA primeiro
                </p>
              ) : templatesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando templates...
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum template aprovado nesta WABA.
                </p>
              ) : (
                <Select
                  value={config.templateName || ''}
                  onValueChange={(value) => {
                    const selected = templates.find((t: any) => t.name === value);
                    updateConfig({
                      templateName: value,
                      templateLanguage: selected?.language || 'pt_BR',
                      templateVariables: {},
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates
                      .filter((t: any) => t.status === 'APPROVED')
                      .map((template: any) => (
                        <SelectItem key={template.id} value={template.name}>
                          {template.name} ({template.language})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Preview do template */}
            {selectedTemplate && (
              <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                <p className="text-xs text-muted-foreground">Prévia do template:</p>
                {selectedTemplate.components?.map((comp: any, idx: number) => (
                  <div key={idx}>
                    {comp.type === 'HEADER' && comp.format === 'IMAGE' && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Image className="h-4 w-4" />
                        <span>Header com imagem</span>
                      </div>
                    )}
                    {comp.type === 'HEADER' && comp.format === 'VIDEO' && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Video className="h-4 w-4" />
                        <span>Header com vídeo</span>
                      </div>
                    )}
                    {comp.type === 'HEADER' && comp.format === 'DOCUMENT' && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>Header com documento</span>
                      </div>
                    )}
                    {comp.type === 'HEADER' && comp.text && (
                      <p className="text-sm font-semibold">{comp.text}</p>
                    )}
                    {comp.type === 'BODY' && (
                      <p className="text-sm">{comp.text}</p>
                    )}
                    {comp.type === 'FOOTER' && (
                      <p className="text-xs text-muted-foreground">{comp.text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload de mídia do header */}
            {selectedTemplate && (() => {
              const headerComp = selectedTemplate.components?.find((c: any) => c.type === 'HEADER');
              if (!headerComp || !['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) return null;

              const mediaType = headerComp.format.toLowerCase() as 'image' | 'video' | 'document';
              const acceptTypes = {
                image: 'image/jpeg,image/png,image/webp',
                video: 'video/mp4,video/3gpp',
                document: 'application/pdf'
              };
              const labels = {
                image: 'Imagem do Header',
                video: 'Vídeo do Header',
                document: 'Documento do Header'
              };
              const icons = {
                image: <Image className="h-4 w-4" />,
                video: <Video className="h-4 w-4" />,
                document: <FileText className="h-4 w-4" />
              };

              return (
                <div className="space-y-2 p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                  <Label className="flex items-center gap-2">
                    {icons[mediaType]}
                    {labels[mediaType]} *
                  </Label>

                  {config.headerImageUrl ? (
                    <div className="space-y-2">
                      {mediaType === 'image' && (
                        <img
                          src={config.headerImageUrl}
                          alt="Header"
                          className="w-full h-32 object-cover rounded"
                        />
                      )}
                      {mediaType === 'video' && (
                        <video
                          src={config.headerImageUrl}
                          className="w-full h-32 object-cover rounded"
                          controls
                        />
                      )}
                      {mediaType === 'document' && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <FileText className="h-5 w-5" />
                          <span className="text-sm truncate flex-1">Documento anexado</span>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => updateConfig({ headerImageUrl: undefined })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        {uploading ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground">Clique para enviar</span>
                          </>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept={acceptTypes[mediaType]}
                          disabled={uploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = await uploadHeaderMedia(file, mediaType);
                              if (url) {
                                updateConfig({ headerImageUrl: url });
                              }
                            }
                          }}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground text-center">
                        {mediaType === 'image' && 'JPG, PNG ou WebP (máx 5MB)'}
                        {mediaType === 'video' && 'MP4 ou 3GPP (máx 16MB)'}
                        {mediaType === 'document' && 'PDF (máx 100MB)'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Variáveis do template */}
            {templateVariables.length > 0 && (
              <div className="space-y-3">
                <Label>Variáveis do template</Label>
                <p className="text-xs text-muted-foreground">
                  Preencha os valores ou use campos do contato
                </p>
                {templateVariables.map((v) => (
                  <div key={`${v.component}-${v.index}`} className="space-y-1">
                    <Label className="text-xs">
                      Variável {`{{${v.index}}}`} ({v.component})
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Valor fixo ou {{campo}}"
                        value={templateVars[`${v.index}`] || ''}
                        onChange={(e) => {
                          updateConfig({
                            templateVariables: {
                              ...templateVars,
                              [`${v.index}`]: e.target.value,
                            },
                          });
                        }}
                        className="flex-1"
                      />
                      <Select
                        value=""
                        onValueChange={(val) => {
                          updateConfig({
                            templateVariables: {
                              ...templateVars,
                              [`${v.index}`]: val,
                            },
                          });
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Campo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="{{nome}}">Nome</SelectItem>
                          <SelectItem value="{{telefone}}">Telefone</SelectItem>
                          <SelectItem value="{{email}}">Email</SelectItem>
                          {customFields.length > 0 && (
                            <>
                              <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1 pt-1">
                                Personalizados
                              </div>
                              {customFields.map((field) => (
                                <SelectItem key={field.id} value={`{{${field.name}}}`}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {config.templateName && templateVariables.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Este template não possui variáveis para preencher.
              </p>
            )}

            {/* Botões do template */}
            {templateButtons.length > 0 && (
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <Label>Aguardar resposta do botão</Label>
                  <Switch
                    checked={config.waitForButtonResponse || false}
                    onCheckedChange={(checked) => {
                      updateConfig({
                        waitForButtonResponse: checked,
                        templateButtons: checked ? templateButtons : undefined
                      });
                    }}
                  />
                </div>
                {config.waitForButtonResponse && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      O fluxo aguardará o usuário clicar em um botão.
                      Conecte cada saída ao próximo passo do fluxo.
                    </p>
                    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                      <p className="text-xs font-medium">Botões detectados:</p>
                      {templateButtons.map((btn, idx) => (
                        <div key={btn.id} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `hsl(${(idx * 60) + 120}, 70%, 50%)` }}
                          />
                          <span className="text-sm">{btn.text}</span>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground mt-2">
                        Cada botão terá uma saída no nó para conectar.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'action_send_buttons':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Texto da mensagem</Label>
              <div className="relative">
                <Textarea
                  placeholder="Digite o texto..."
                  value={config.body || ''}
                  onChange={(e) => updateConfig({ body: e.target.value.slice(0, WHATSAPP_LIMITS.INTERACTIVE_BODY) })}
                  rows={3}
                  maxLength={WHATSAPP_LIMITS.INTERACTIVE_BODY}
                />
                <div className="absolute bottom-1 right-2">
                  <CharCounter value={config.body || ''} limit={WHATSAPP_LIMITS.INTERACTIVE_BODY} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Botões (máx. 3)</Label>
                {(config.buttons?.length || 0) < 3 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateConfig({
                        buttons: [...(config.buttons || []), { id: `btn_${Date.now()}`, text: '' }],
                      })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {config.buttons?.map((btn, idx) => (
                  <div key={btn.id} className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder={`Botão ${idx + 1}`}
                        value={btn.text}
                        onChange={(e) => {
                          const newButtons = [...(config.buttons || [])];
                          newButtons[idx] = { ...btn, text: e.target.value.slice(0, WHATSAPP_LIMITS.INTERACTIVE_BUTTON_TEXT) };
                          updateConfig({ buttons: newButtons });
                        }}
                        maxLength={WHATSAPP_LIMITS.INTERACTIVE_BUTTON_TEXT}
                        className="pr-12"
                      />
                      <div className="absolute top-1/2 right-2 -translate-y-1/2">
                        <CharCounter value={btn.text} limit={WHATSAPP_LIMITS.INTERACTIVE_BUTTON_TEXT} />
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const newButtons = config.buttons?.filter((_, i) => i !== idx);
                        updateConfig({ buttons: newButtons });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'condition_button': {
        const conditions = config.conditions || [];
        return (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Configure qual botão leva para cada caminho do fluxo.
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Condições de botão</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newConditions = [
                      ...conditions,
                      { buttonText: '', output: `btn_${conditions.length}` }
                    ];
                    updateConfig({ conditions: newConditions });
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-3">
                {conditions.map((cond, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: `hsl(${(idx * 60) + 120}, 70%, 50%)` }}
                      />
                      <span className="text-xs text-muted-foreground">Saída {idx + 1}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-6 w-6"
                        onClick={() => {
                          const newConditions = conditions.filter((_, i) => i !== idx);
                          updateConfig({ conditions: newConditions });
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Texto do botão (ex: Confirmar)"
                      value={cond.buttonText}
                      onChange={(e) => {
                        const newConditions = [...conditions];
                        newConditions[idx] = { ...cond, buttonText: e.target.value };
                        updateConfig({ conditions: newConditions });
                      }}
                    />
                  </div>
                ))}
              </div>
              {conditions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Adicione condições para cada botão do template
                </p>
              )}
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground space-y-1">
              <p><strong>Como funciona:</strong></p>
              <p>• Cada condição verifica se o botão clicado contém o texto especificado</p>
              <p>• Conecte cada saída colorida ao próximo passo do fluxo</p>
              <p>• Ex: "Confirmar" → envia confirmação, "Reagendar" → envia opções</p>
            </div>
          </div>
        );
      }

      case 'condition_tag':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tag</Label>
              <Input
                placeholder="Nome da tag"
                value={config.tag || ''}
                onChange={(e) => updateConfig({ tag: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Contato tem a tag</Label>
              <Switch
                checked={config.hasTag !== false}
                onCheckedChange={(checked) => updateConfig({ hasTag: checked })}
              />
            </div>
          </div>
        );

      case 'condition_field':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Campo</Label>
              <Select value={config.field || ''} onValueChange={(v) => updateConfig({ field: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone_number">Telefone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operador</Label>
              <Select value={config.operator || 'equals'} onValueChange={(v) => updateConfig({ operator: v as NodeConfig['operator'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Igual a</SelectItem>
                  <SelectItem value="not_equals">Diferente de</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="empty">Está vazio</SelectItem>
                  <SelectItem value="not_empty">Não está vazio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!['empty', 'not_empty'].includes(config.operator || '') && (
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  placeholder="Digite o valor"
                  value={config.value || ''}
                  onChange={(e) => updateConfig({ value: e.target.value })}
                />
              </div>
            )}
          </div>
        );

      case 'action_delay':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={config.amount || 1}
                  onChange={(e) => updateConfig({ amount: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={config.unit || 'minutes'} onValueChange={(v) => updateConfig({ unit: v as NodeConfig['unit'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="days">Dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'action_add_tag':
      case 'action_remove_tag':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{type === 'action_add_tag' ? 'Tag a adicionar' : 'Tag a remover'}</Label>
              <Input
                placeholder="Nome da tag"
                value={config.tag || ''}
                onChange={(e) => updateConfig({ tag: e.target.value })}
              />
            </div>
          </div>
        );

      case 'action_update_field':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Campo</Label>
              <Select value={config.field || ''} onValueChange={(v) => updateConfig({ field: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Novo valor</Label>
              <Input
                placeholder="Digite o valor"
                value={config.value || ''}
                onChange={(e) => updateConfig({ value: e.target.value })}
              />
            </div>
          </div>
        );

      case 'action_webhook':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                placeholder="https://api.exemplo.com/webhook"
                value={config.url || ''}
                onChange={(e) => updateConfig({ url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={config.method || 'POST'} onValueChange={(v) => updateConfig({ method: v as 'GET' | 'POST' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'action_send_cta_url': {
        const ctaUrl = config.ctaUrl || { bodyText: '', buttonText: '', url: '' };
        const isValidUrl = (url: string) => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        };
        const urlError = ctaUrl.url && !isValidUrl(ctaUrl.url);

        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Header (opcional)</Label>
              <div className="relative">
                <Input
                  placeholder="Título da mensagem"
                  value={ctaUrl.headerText || ''}
                  onChange={(e) => updateConfig({ ctaUrl: { ...ctaUrl, headerText: e.target.value.slice(0, WHATSAPP_LIMITS.CTA_HEADER) } })}
                  maxLength={WHATSAPP_LIMITS.CTA_HEADER}
                  className="pr-14"
                />
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  <CharCounter value={ctaUrl.headerText || ''} limit={WHATSAPP_LIMITS.CTA_HEADER} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Corpo da mensagem *</Label>
              <div className="relative">
                <Textarea
                  placeholder="Digite o texto principal da mensagem..."
                  value={ctaUrl.bodyText || ''}
                  onChange={(e) => updateConfig({ ctaUrl: { ...ctaUrl, bodyText: e.target.value.slice(0, WHATSAPP_LIMITS.CTA_BODY) } })}
                  rows={3}
                  maxLength={WHATSAPP_LIMITS.CTA_BODY}
                />
                <div className="absolute bottom-1 right-2">
                  <CharCounter value={ctaUrl.bodyText || ''} limit={WHATSAPP_LIMITS.CTA_BODY} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Footer (opcional)</Label>
              <div className="relative">
                <Input
                  placeholder="Texto do rodapé"
                  value={ctaUrl.footerText || ''}
                  onChange={(e) => updateConfig({ ctaUrl: { ...ctaUrl, footerText: e.target.value.slice(0, WHATSAPP_LIMITS.CTA_FOOTER) } })}
                  maxLength={WHATSAPP_LIMITS.CTA_FOOTER}
                  className="pr-14"
                />
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  <CharCounter value={ctaUrl.footerText || ''} limit={WHATSAPP_LIMITS.CTA_FOOTER} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Texto do botão *</Label>
              <div className="relative">
                <Input
                  placeholder="ex: Acessar Site"
                  value={ctaUrl.buttonText || ''}
                  onChange={(e) => updateConfig({ ctaUrl: { ...ctaUrl, buttonText: e.target.value.slice(0, WHATSAPP_LIMITS.CTA_BUTTON_TEXT) } })}
                  maxLength={WHATSAPP_LIMITS.CTA_BUTTON_TEXT}
                  className="pr-12"
                />
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  <CharCounter value={ctaUrl.buttonText || ''} limit={WHATSAPP_LIMITS.CTA_BUTTON_TEXT} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL do link *</Label>
              <Input
                placeholder="https://exemplo.com"
                value={ctaUrl.url || ''}
                onChange={(e) => updateConfig({ ctaUrl: { ...ctaUrl, url: e.target.value.slice(0, WHATSAPP_LIMITS.CTA_URL) } })}
                className={urlError ? 'border-destructive' : ''}
                maxLength={WHATSAPP_LIMITS.CTA_URL}
              />
              {urlError && (
                <p className="text-xs text-destructive">URL inválida</p>
              )}
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prévia</Label>
              <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                {ctaUrl.headerText && (
                  <p className="text-sm font-semibold">{ctaUrl.headerText}</p>
                )}
                <p className="text-sm">{ctaUrl.bodyText || 'Corpo da mensagem...'}</p>
                {ctaUrl.footerText && (
                  <p className="text-xs text-muted-foreground">{ctaUrl.footerText}</p>
                )}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-center gap-2 text-primary text-sm font-medium py-2 bg-primary/10 rounded">
                    <ExternalLink className="h-4 w-4" />
                    {ctaUrl.buttonText || 'Texto do botão'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'trigger_contact_created':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook para criar contatos</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${API_URL}/api/webhook/contacts`}
                  className="flex-1 text-xs"
                />
                <Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(`${API_URL}/api/webhook/contacts`)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-xs space-y-2">
              <p className="font-medium">Exemplo de payload:</p>
              <pre className="bg-background p-2 rounded text-[10px] overflow-x-auto">
{`POST ${API_URL}/api/webhook/contacts
Content-Type: application/json

{
  "name": "João Silva",
  "phone": "5511999999999",
  "custom_fields": {
    "produto": "Curso XYZ",
    "valor": "R$ 497"
  },
  "tags": ["lead", "facebook"],
  "trigger_flow": true
}`}
              </pre>
            </div>
            <div className="text-xs text-muted-foreground">
              <p><strong>trigger_flow:</strong> true para disparar fluxo, false para apenas criar</p>
              <p><strong>tags:</strong> lista de tags para adicionar ao contato</p>
            </div>
          </div>
        );

      case 'trigger_message':
        return (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Este trigger é ativado quando qualquer mensagem é recebida.
            </div>
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground text-center py-8">
            Configuração não disponível para este tipo de nó.
          </div>
        );
    }
  };

  return (
    <div className="w-80 border-l bg-background h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm truncate">{label}</h3>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {renderConfig()}
      </ScrollArea>

      <div className="p-4 border-t">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => onDelete(node.id)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir Nó
        </Button>
      </div>
    </div>
  );
}

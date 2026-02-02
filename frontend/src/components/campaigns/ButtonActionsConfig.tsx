import { useState } from 'react';
import {
  MessageCircle, Tag, Globe, X, ChevronDown, ChevronUp,
  Plus, Trash2, Image, Link, Clock, LayoutGrid, GripVertical,
  ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { WHATSAPP_LIMITS, getCharCounterProps } from '@/lib/whatsappLimits';

// Componente auxiliar para contador de caracteres
function CharCounter({ value, limit }: { value: string; limit: number }) {
  const { text, className } = getCharCounterProps(value || '', limit);
  return <span className={cn('text-xs', className)}>{text}</span>;
}

// Tipos de ação disponíveis
export type ActionType =
  | 'send_text'
  | 'send_image'
  | 'send_cta_url'
  | 'send_buttons'
  | 'delay'
  | 'add_tag'
  | 'webhook';

// Uma única ação dentro do fluxo
export interface FlowAction {
  id: string;
  type: ActionType;
  // Para send_text
  message?: string;
  // Para send_image
  imageUrl?: string;
  imageCaption?: string;
  // Para send_cta_url
  ctaHeader?: string;
  ctaText?: string;
  ctaFooter?: string;
  ctaUrl?: string;
  ctaButtonText?: string;
  // Para send_buttons
  buttonsText?: string;
  buttons?: Array<{ id: string; text: string }>;
  // Sub-fluxos para cada botão (quando send_buttons)
  buttonFlows?: Record<string, FlowAction[]>;
  // Para delay
  delaySeconds?: number;
  // Para add_tag
  tag?: string;
  // Para webhook
  webhookUrl?: string;
}

// Mapa de ações por botão (cada botão tem um array de ações)
export interface ButtonActionsMap {
  [buttonText: string]: FlowAction[];
}

interface TemplateButton {
  type: string;
  text: string;
}

interface ButtonActionsConfigProps {
  buttons: TemplateButton[];
  buttonActions: ButtonActionsMap;
  onButtonActionsChange: (actions: ButtonActionsMap) => void;
  customFields?: Array<{ name: string; label: string }>;
}

const actionTypes = [
  { value: 'send_text', label: 'Enviar Texto', icon: MessageCircle, color: 'text-green-600' },
  { value: 'send_image', label: 'Enviar Imagem', icon: Image, color: 'text-blue-600' },
  { value: 'send_cta_url', label: 'Mensagem com Link', icon: Link, color: 'text-purple-600' },
  { value: 'send_buttons', label: 'Mensagem com Botões', icon: LayoutGrid, color: 'text-orange-600' },
  { value: 'delay', label: 'Aguardar (Delay)', icon: Clock, color: 'text-yellow-600' },
  { value: 'add_tag', label: 'Adicionar Tag', icon: Tag, color: 'text-pink-600' },
  { value: 'webhook', label: 'Chamar Webhook', icon: Globe, color: 'text-cyan-600' },
];

const buttonColors = [
  'bg-green-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-orange-500',
];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Componente para editar uma única ação
function ActionEditor({
  action,
  onUpdate,
  onDelete,
  customFields = [],
  isLast
}: {
  action: FlowAction;
  onUpdate: (updates: Partial<FlowAction>) => void;
  onDelete: () => void;
  customFields?: Array<{ name: string; label: string }>;
  isLast: boolean;
}) {
  const actionType = actionTypes.find(t => t.value === action.type);
  const Icon = actionType?.icon || MessageCircle;

  return (
    <div className="relative">
      <div className="flex gap-2 p-3 bg-muted/30 rounded-lg border">
        <div className="flex flex-col items-center gap-1 pt-1">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <div className={cn('p-1.5 rounded', actionType?.color, 'bg-current/10')}>
            <Icon className={cn('h-4 w-4', actionType?.color)} />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {/* Tipo de ação */}
          <div className="flex items-center gap-2">
            <Select
              value={action.type}
              onValueChange={(value) => onUpdate({ type: value as ActionType })}
            >
              <SelectTrigger className="flex-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className={cn('h-4 w-4', type.color)} />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          {/* Configuração específica por tipo */}
          {action.type === 'send_text' && (
            <div className="space-y-2">
              <div className="relative">
                <Textarea
                  placeholder="Digite a mensagem..."
                  value={action.message || ''}
                  onChange={(e) => onUpdate({ message: e.target.value.slice(0, WHATSAPP_LIMITS.TEXT_MESSAGE) })}
                  rows={2}
                  className="text-sm"
                  maxLength={WHATSAPP_LIMITS.TEXT_MESSAGE}
                />
                <div className="absolute bottom-1 right-2">
                  <CharCounter value={action.message || ''} limit={WHATSAPP_LIMITS.TEXT_MESSAGE} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">Variáveis:</span>
                {['{{nome}}', '{{telefone}}'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded hover:bg-primary/20"
                    onClick={() => onUpdate({ message: (action.message || '') + ' ' + v })}
                  >
                    {v}
                  </button>
                ))}
                {customFields.slice(0, 3).map((field) => (
                  <button
                    key={field.name}
                    type="button"
                    className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded hover:bg-primary/20"
                    onClick={() => onUpdate({ message: (action.message || '') + ` {{${field.name}}}` })}
                  >
                    {`{{${field.name}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {action.type === 'send_image' && (
            <div className="space-y-2">
              <ImageUpload
                value={action.imageUrl || ''}
                onChange={(url) => onUpdate({ imageUrl: url })}
                placeholder="Cole a URL ou faça upload"
              />
              <div className="relative">
                <Input
                  placeholder="Legenda (opcional)"
                  value={action.imageCaption || ''}
                  onChange={(e) => onUpdate({ imageCaption: e.target.value.slice(0, WHATSAPP_LIMITS.MEDIA_CAPTION) })}
                  className="text-sm pr-16"
                  maxLength={WHATSAPP_LIMITS.MEDIA_CAPTION}
                />
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  <CharCounter value={action.imageCaption || ''} limit={WHATSAPP_LIMITS.MEDIA_CAPTION} />
                </div>
              </div>
            </div>
          )}

          {action.type === 'send_cta_url' && (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder="Header (opcional)"
                  value={action.ctaHeader || ''}
                  onChange={(e) => onUpdate({ ctaHeader: e.target.value.slice(0, WHATSAPP_LIMITS.CTA_HEADER) })}
                  className="text-sm pr-16"
                  maxLength={WHATSAPP_LIMITS.CTA_HEADER}
                />
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  <CharCounter value={action.ctaHeader || ''} limit={WHATSAPP_LIMITS.CTA_HEADER} />
                </div>
              </div>
              <div className="relative">
                <Textarea
                  placeholder="Corpo da mensagem..."
                  value={action.ctaText || ''}
                  onChange={(e) => onUpdate({ ctaText: e.target.value.slice(0, WHATSAPP_LIMITS.CTA_BODY) })}
                  rows={2}
                  className="text-sm"
                  maxLength={WHATSAPP_LIMITS.CTA_BODY}
                />
                <div className="absolute bottom-1 right-2">
                  <CharCounter value={action.ctaText || ''} limit={WHATSAPP_LIMITS.CTA_BODY} />
                </div>
              </div>
              <div className="relative">
                <Input
                  placeholder="Footer (opcional)"
                  value={action.ctaFooter || ''}
                  onChange={(e) => onUpdate({ ctaFooter: e.target.value.slice(0, WHATSAPP_LIMITS.CTA_FOOTER) })}
                  className="text-sm pr-16"
                  maxLength={WHATSAPP_LIMITS.CTA_FOOTER}
                />
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  <CharCounter value={action.ctaFooter || ''} limit={WHATSAPP_LIMITS.CTA_FOOTER} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Input
                    placeholder="Texto do botão"
                    value={action.ctaButtonText || ''}
                    onChange={(e) => onUpdate({ ctaButtonText: e.target.value.slice(0, WHATSAPP_LIMITS.CTA_BUTTON_TEXT) })}
                    className="text-sm pr-12"
                    maxLength={WHATSAPP_LIMITS.CTA_BUTTON_TEXT}
                  />
                  <div className="absolute top-1/2 right-2 -translate-y-1/2">
                    <CharCounter value={action.ctaButtonText || ''} limit={WHATSAPP_LIMITS.CTA_BUTTON_TEXT} />
                  </div>
                </div>
                <Input
                  placeholder="URL do link"
                  value={action.ctaUrl || ''}
                  onChange={(e) => onUpdate({ ctaUrl: e.target.value.slice(0, WHATSAPP_LIMITS.CTA_URL) })}
                  className="text-sm"
                  maxLength={WHATSAPP_LIMITS.CTA_URL}
                />
              </div>
            </div>
          )}

          {action.type === 'send_buttons' && (
            <div className="space-y-3">
              <div className="relative">
                <Textarea
                  placeholder="Texto da mensagem..."
                  value={action.buttonsText || ''}
                  onChange={(e) => onUpdate({ buttonsText: e.target.value.slice(0, WHATSAPP_LIMITS.INTERACTIVE_BODY) })}
                  rows={2}
                  className="text-sm"
                  maxLength={WHATSAPP_LIMITS.INTERACTIVE_BODY}
                />
                <div className="absolute bottom-1 right-2">
                  <CharCounter value={action.buttonsText || ''} limit={WHATSAPP_LIMITS.INTERACTIVE_BODY} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Botões e seus fluxos (máx. 3)</Label>
                {(action.buttons || []).map((btn, idx) => (
                  <div key={btn.id} className="border rounded-lg p-2 bg-muted/20">
                    <div className="flex gap-1 mb-2">
                      <div className="relative flex-1">
                        <Input
                          placeholder={`Botão ${idx + 1}`}
                          value={btn.text}
                          onChange={(e) => {
                            const newValue = e.target.value.slice(0, WHATSAPP_LIMITS.INTERACTIVE_BUTTON_TEXT);
                            const newButtons = [...(action.buttons || [])];
                            const oldText = btn.text;
                            newButtons[idx] = { ...btn, text: newValue };
                            // Atualizar buttonFlows com novo nome
                            const newFlows = { ...(action.buttonFlows || {}) };
                            if (oldText && newFlows[oldText]) {
                              newFlows[newValue] = newFlows[oldText];
                              delete newFlows[oldText];
                            }
                            onUpdate({ buttons: newButtons, buttonFlows: newFlows });
                          }}
                          className="text-sm h-8 pr-12"
                          maxLength={WHATSAPP_LIMITS.INTERACTIVE_BUTTON_TEXT}
                        />
                        <div className="absolute top-1/2 right-2 -translate-y-1/2">
                          <CharCounter value={btn.text} limit={WHATSAPP_LIMITS.INTERACTIVE_BUTTON_TEXT} />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => {
                          const newButtons = (action.buttons || []).filter((_, i) => i !== idx);
                          const newFlows = { ...(action.buttonFlows || {}) };
                          delete newFlows[btn.text];
                          onUpdate({ buttons: newButtons, buttonFlows: newFlows });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* Sub-ações do botão */}
                    {btn.text && (
                      <div className="ml-2 pl-2 border-l-2 border-primary/30 space-y-1">
                        <p className="text-xs text-muted-foreground">Ao clicar "{btn.text}":</p>
                        {(action.buttonFlows?.[btn.text] || []).map((subAction, subIdx) => (
                          <div key={subAction.id} className="flex items-center gap-1 text-xs bg-background rounded p-1">
                            <span className="flex-1 truncate">
                              {subIdx + 1}. {actionTypes.find(t => t.value === subAction.type)?.label}
                              {subAction.message && `: "${subAction.message.slice(0, 20)}..."`}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => {
                                const newFlows = { ...(action.buttonFlows || {}) };
                                newFlows[btn.text] = (newFlows[btn.text] || []).filter((_, i) => i !== subIdx);
                                onUpdate({ buttonFlows: newFlows });
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Select
                          value=""
                          onValueChange={(type) => {
                            if (!type) return;
                            const newFlows = { ...(action.buttonFlows || {}) };
                            if (!newFlows[btn.text]) newFlows[btn.text] = [];
                            newFlows[btn.text].push({ id: generateId(), type: type as ActionType });
                            onUpdate({ buttonFlows: newFlows });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="+ Adicionar ação..." />
                          </SelectTrigger>
                          <SelectContent>
                            {actionTypes.filter(t => t.value !== 'send_buttons').map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <type.icon className={cn('h-3 w-3', type.color)} />
                                  {type.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Editar sub-ações */}
                        {(action.buttonFlows?.[btn.text] || []).map((subAction, subIdx) => (
                          <div key={`edit-${subAction.id}`} className="bg-background rounded p-2 text-xs space-y-1">
                            {subAction.type === 'send_text' && (
                              <Textarea
                                placeholder="Mensagem..."
                                value={subAction.message || ''}
                                onChange={(e) => {
                                  const newFlows = { ...(action.buttonFlows || {}) };
                                  newFlows[btn.text][subIdx] = { ...subAction, message: e.target.value };
                                  onUpdate({ buttonFlows: newFlows });
                                }}
                                rows={2}
                                className="text-xs"
                              />
                            )}
                            {subAction.type === 'send_image' && (
                              <ImageUpload
                                value={subAction.imageUrl || ''}
                                onChange={(url) => {
                                  const newFlows = { ...(action.buttonFlows || {}) };
                                  newFlows[btn.text][subIdx] = { ...subAction, imageUrl: url };
                                  onUpdate({ buttonFlows: newFlows });
                                }}
                                placeholder="URL da imagem"
                              />
                            )}
                            {subAction.type === 'send_cta_url' && (
                              <div className="space-y-1">
                                <Input
                                  placeholder="Texto da mensagem"
                                  value={subAction.ctaText || ''}
                                  onChange={(e) => {
                                    const newFlows = { ...(action.buttonFlows || {}) };
                                    newFlows[btn.text][subIdx] = { ...subAction, ctaText: e.target.value };
                                    onUpdate({ buttonFlows: newFlows });
                                  }}
                                  className="text-xs h-7"
                                />
                                <div className="flex gap-1">
                                  <Input
                                    placeholder="Texto do botão"
                                    value={subAction.ctaButtonText || ''}
                                    onChange={(e) => {
                                      const newFlows = { ...(action.buttonFlows || {}) };
                                      newFlows[btn.text][subIdx] = { ...subAction, ctaButtonText: e.target.value };
                                      onUpdate({ buttonFlows: newFlows });
                                    }}
                                    className="text-xs h-7"
                                  />
                                  <Input
                                    placeholder="URL"
                                    value={subAction.ctaUrl || ''}
                                    onChange={(e) => {
                                      const newFlows = { ...(action.buttonFlows || {}) };
                                      newFlows[btn.text][subIdx] = { ...subAction, ctaUrl: e.target.value };
                                      onUpdate({ buttonFlows: newFlows });
                                    }}
                                    className="text-xs h-7"
                                  />
                                </div>
                              </div>
                            )}
                            {subAction.type === 'delay' && (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="1"
                                  max="300"
                                  placeholder="Segundos"
                                  value={subAction.delaySeconds || ''}
                                  onChange={(e) => {
                                    const newFlows = { ...(action.buttonFlows || {}) };
                                    newFlows[btn.text][subIdx] = { ...subAction, delaySeconds: parseInt(e.target.value) || 0 };
                                    onUpdate({ buttonFlows: newFlows });
                                  }}
                                  className="w-20 text-xs h-7"
                                />
                                <span className="text-muted-foreground">segundos</span>
                              </div>
                            )}
                            {subAction.type === 'add_tag' && (
                              <Input
                                placeholder="Nome da tag"
                                value={subAction.tag || ''}
                                onChange={(e) => {
                                  const newFlows = { ...(action.buttonFlows || {}) };
                                  newFlows[btn.text][subIdx] = { ...subAction, tag: e.target.value };
                                  onUpdate({ buttonFlows: newFlows });
                                }}
                                className="text-xs h-7"
                              />
                            )}
                            {subAction.type === 'webhook' && (
                              <Input
                                placeholder="URL do webhook"
                                value={subAction.webhookUrl || ''}
                                onChange={(e) => {
                                  const newFlows = { ...(action.buttonFlows || {}) };
                                  newFlows[btn.text][subIdx] = { ...subAction, webhookUrl: e.target.value };
                                  onUpdate({ buttonFlows: newFlows });
                                }}
                                className="text-xs h-7"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {(action.buttons?.length || 0) < 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => {
                      const newButtons = [...(action.buttons || []), { id: generateId(), text: '' }];
                      onUpdate({ buttons: newButtons });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar Botão
                  </Button>
                )}
              </div>
            </div>
          )}

          {action.type === 'delay' && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="300"
                placeholder="Segundos"
                value={action.delaySeconds || ''}
                onChange={(e) => onUpdate({ delaySeconds: parseInt(e.target.value) || 0 })}
                className="w-24 text-sm"
              />
              <span className="text-sm text-muted-foreground">segundos de espera</span>
            </div>
          )}

          {action.type === 'add_tag' && (
            <Input
              placeholder="Nome da tag (ex: confirmado)"
              value={action.tag || ''}
              onChange={(e) => onUpdate({ tag: e.target.value })}
              className="text-sm"
            />
          )}

          {action.type === 'webhook' && (
            <div className="space-y-1">
              <Input
                placeholder="URL do webhook"
                value={action.webhookUrl || ''}
                onChange={(e) => onUpdate({ webhookUrl: e.target.value })}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">POST com dados do contato e botão</p>
            </div>
          )}
        </div>
      </div>

      {/* Seta indicando sequência */}
      {!isLast && (
        <div className="flex justify-center py-1">
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function ButtonActionsConfig({
  buttons,
  buttonActions,
  onButtonActionsChange,
  customFields = [],
}: ButtonActionsConfigProps) {
  const [expandedButtons, setExpandedButtons] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    buttons.forEach(btn => { initial[btn.text] = true; });
    return initial;
  });

  const getActions = (buttonText: string): FlowAction[] => {
    return buttonActions[buttonText] || [];
  };

  const updateActions = (buttonText: string, actions: FlowAction[]) => {
    onButtonActionsChange({
      ...buttonActions,
      [buttonText]: actions,
    });
  };

  const addAction = (buttonText: string) => {
    const actions = getActions(buttonText);
    updateActions(buttonText, [
      ...actions,
      { id: generateId(), type: 'send_text', message: '' }
    ]);
  };

  const updateAction = (buttonText: string, actionId: string, updates: Partial<FlowAction>) => {
    const actions = getActions(buttonText);
    updateActions(buttonText, actions.map(a =>
      a.id === actionId ? { ...a, ...updates } : a
    ));
  };

  const deleteAction = (buttonText: string, actionId: string) => {
    const actions = getActions(buttonText);
    updateActions(buttonText, actions.filter(a => a.id !== actionId));
  };

  const toggleExpanded = (buttonText: string) => {
    setExpandedButtons(prev => ({ ...prev, [buttonText]: !prev[buttonText] }));
  };

  const getActionsSummary = (actions: FlowAction[]): string => {
    if (actions.length === 0) return 'Nenhuma ação configurada';
    if (actions.length === 1) {
      const action = actions[0];
      const type = actionTypes.find(t => t.value === action.type);
      return type?.label || 'Ação configurada';
    }
    return `${actions.length} ações configuradas`;
  };

  if (buttons.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-base">Fluxo de Ações dos Botões</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a sequência de ações que serão executadas quando o cliente clicar em cada botão.
        </p>
      </div>

      <div className="space-y-3">
        {buttons.filter(btn => btn.type === 'QUICK_REPLY').map((button, index) => {
          const actions = getActions(button.text);
          const isExpanded = expandedButtons[button.text];
          const colorClass = buttonColors[index % buttonColors.length];

          return (
            <Card key={button.text} className="overflow-hidden">
              {/* Header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpanded(button.text)}
              >
                <div className={cn('w-3 h-3 rounded-full shrink-0', colorClass)} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Botão: "{button.text}"</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getActionsSummary(actions)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {actions.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {actions.length} {actions.length === 1 ? 'etapa' : 'etapas'}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="p-3 pt-0 border-t bg-muted/10 space-y-2">
                  {/* Lista de ações */}
                  {actions.map((action, idx) => (
                    <ActionEditor
                      key={action.id}
                      action={action}
                      onUpdate={(updates) => updateAction(button.text, action.id, updates)}
                      onDelete={() => deleteAction(button.text, action.id)}
                      customFields={customFields}
                      isLast={idx === actions.length - 1}
                    />
                  ))}

                  {/* Botão para adicionar ação */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => addAction(button.text)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Etapa
                  </Button>

                  {actions.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Clique em "Adicionar Etapa" para criar o fluxo de ações
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Resumo */}
      {Object.values(buttonActions).some(a => a.length > 0) && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 font-medium">
            {Object.entries(buttonActions)
              .filter(([_, actions]) => actions.length > 0)
              .map(([btn, actions]) => `${btn}: ${actions.length} etapa(s)`)
              .join(' • ')}
          </p>
        </div>
      )}
    </div>
  );
}

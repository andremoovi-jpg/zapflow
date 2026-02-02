import { useState, useEffect } from 'react';
import { Search, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useWABA } from '@/contexts/WABAContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  language: string;
  category: string | null;
  status: string | null;
  components: {
    type: string;
    text?: string;
    format?: string;
    parameters?: { type: string }[];
  }[];
}

interface SendTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (templateId: string, variables: Record<string, string>) => void;
  conversationId: string | null;
}

export function SendTemplateModal({
  open,
  onOpenChange,
  onSend,
  conversationId,
}: SendTemplateModalProps) {
  const { selectedWABA } = useWABA();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [conversationWabaId, setConversationWabaId] = useState<string | null>(null);

  // Buscar wabaId da conversa ou usar o selecionado globalmente
  useEffect(() => {
    async function fetchConversationWaba() {
      if (!conversationId) {
        setConversationWabaId(null);
        return;
      }

      const { data } = await supabase
        .from('conversations')
        .select('whatsapp_account_id')
        .eq('id', conversationId)
        .single();

      setConversationWabaId(data?.whatsapp_account_id || null);
    }

    if (open) {
      fetchConversationWaba();
    }
  }, [conversationId, open]);

  // O wabaId para filtrar templates: da conversa ou do contexto
  const effectiveWabaId = conversationWabaId || selectedWABA?.id;

  useEffect(() => {
    if (open && effectiveWabaId) {
      fetchTemplates();
    }
  }, [open, effectiveWabaId]);

  const fetchTemplates = async () => {
    if (!effectiveWabaId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('whatsapp_account_id', effectiveWabaId)
        .eq('status', 'APPROVED');

      if (error) throw error;
      setTemplates((data || []).map(t => ({
        ...t,
        components: t.components as Template['components'],
      })));
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const getBodyComponent = (template: Template) => {
    return template.components.find(c => c.type === 'BODY');
  };

  const getVariableCount = (template: Template) => {
    const body = getBodyComponent(template);
    if (!body?.text) return 0;
    const matches = body.text.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  };

  const renderTemplatePreview = (template: Template) => {
    const body = getBodyComponent(template);
    if (!body?.text) return '';

    let text = body.text;
    Object.entries(variables).forEach(([key, value]) => {
      text = text.replace(key, value || `[${key}]`);
    });
    return text;
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    // Initialize variables
    const varCount = getVariableCount(template);
    const vars: Record<string, string> = {};
    for (let i = 1; i <= varCount; i++) {
      vars[`{{${i}}}`] = '';
    }
    setVariables(vars);
  };

  const handleSend = () => {
    if (!selectedTemplate) return;
    
    // Check if all variables are filled
    const emptyVars = Object.entries(variables).filter(([_, v]) => !v.trim());
    if (emptyVars.length > 0) {
      toast.error('Preencha todas as variáveis');
      return;
    }

    onSend(selectedTemplate.id, variables);
    onOpenChange(false);
    setSelectedTemplate(null);
    setVariables({});
    setSearch('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedTemplate(null);
    setVariables({});
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Enviar Template</DialogTitle>
          <DialogDescription>
            Selecione um template aprovado para enviar ao contato
          </DialogDescription>
        </DialogHeader>

        <div className="flex h-[500px]">
          {/* Template List */}
          <div className="w-1/2 border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar templates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando...
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum template encontrado
                </div>
              ) : (
                filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={cn(
                      'p-4 border-b border-border cursor-pointer transition-colors',
                      selectedTemplate?.id === template.id
                        ? 'bg-accent'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{template.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {template.language}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {getBodyComponent(template)?.text || 'Sem conteúdo'}
                    </p>
                    {template.category && (
                      <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-muted rounded">
                        {template.category}
                      </span>
                    )}
                  </div>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Template Preview & Variables */}
          <div className="w-1/2 flex flex-col">
            {selectedTemplate ? (
              <>
                <div className="p-4 border-b border-border">
                  <h4 className="font-medium">{selectedTemplate.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {getVariableCount(selectedTemplate)} variáveis
                  </p>
                </div>
                <ScrollArea className="flex-1 p-4">
                  {/* Preview */}
                  <div className="mb-4">
                    <Label className="text-xs text-muted-foreground uppercase">
                      Preview
                    </Label>
                    <div className="mt-2 p-3 bg-primary/10 rounded-lg text-sm">
                      {renderTemplatePreview(selectedTemplate)}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Variables */}
                  {Object.keys(variables).length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-xs text-muted-foreground uppercase">
                        Variáveis
                      </Label>
                      {Object.keys(variables).map((key) => (
                        <div key={key}>
                          <Label className="text-sm">{key}</Label>
                          <Input
                            value={variables[key]}
                            onChange={(e) => setVariables({
                              ...variables,
                              [key]: e.target.value,
                            })}
                            placeholder={`Valor para ${key}`}
                            className="mt-1"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <div className="p-4 border-t border-border">
                  <Button className="w-full" onClick={handleSend}>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Template
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Selecione um template</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

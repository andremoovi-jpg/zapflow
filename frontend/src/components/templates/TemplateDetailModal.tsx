import { useState, useMemo } from 'react';
import { CheckCircle2, Clock, XCircle, Copy, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TemplatePreview } from './TemplatePreview';
import type { Template } from '@/hooks/useTemplates';
import { extractVariables, getComponent } from '@/hooks/useTemplates';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TemplateDetailModalProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendTemplate?: (template: Template, variables: Record<string, string>) => void;
}

export function TemplateDetailModal({ 
  template, 
  open, 
  onOpenChange,
  onSendTemplate 
}: TemplateDetailModalProps) {
  const [variables, setVariables] = useState<Record<string, string>>({});

  const bodyComponent = template ? getComponent(template.components, 'BODY') : null;
  const headerComponent = template ? getComponent(template.components, 'HEADER') : null;

  const allVariables = useMemo(() => {
    if (!template) return [];
    
    const vars: string[] = [];
    
    if (headerComponent?.text) {
      vars.push(...extractVariables(headerComponent.text));
    }
    if (bodyComponent?.text) {
      vars.push(...extractVariables(bodyComponent.text));
    }
    
    return [...new Set(vars)].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''));
      const numB = parseInt(b.replace(/\D/g, ''));
      return numA - numB;
    });
  }, [template, headerComponent, bodyComponent]);

  const handleVariableChange = (variable: string, value: string) => {
    const num = variable.replace(/\D/g, '');
    setVariables(prev => ({ ...prev, [num]: value }));
  };

  const handleCopyName = () => {
    if (template) {
      navigator.clipboard.writeText(template.name);
      toast.success('Nome do template copiado!');
    }
  };

  const handleSend = () => {
    if (template && onSendTemplate) {
      onSendTemplate(template, variables);
      onOpenChange(false);
    }
  };

  if (!template) return null;

  const getStatusBadge = () => {
    switch (template.status) {
      case 'APPROVED':
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Aprovado
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejeitado
          </Badge>
        );
      default:
        return null;
    }
  };

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case 'MARKETING':
        return 'Marketing';
      case 'UTILITY':
        return 'Utilidade';
      case 'AUTHENTICATION':
        return 'Autenticação';
      default:
        return category || 'N/A';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{template.name}</span>
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Info & Variables */}
          <div className="space-y-6">
            {/* Template Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Informações
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{template.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyName}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Idioma:</span>
                  <p>{template.language}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Categoria:</span>
                  <p>{getCategoryLabel(template.category)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Última Sync:</span>
                  <p>
                    {template.synced_at 
                      ? format(new Date(template.synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'Nunca'
                    }
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Variables */}
            {allVariables.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Variáveis
                </h3>
                <p className="text-xs text-muted-foreground">
                  Preencha os valores para ver o preview atualizado
                </p>
                <div className="space-y-3">
                  {allVariables.map((variable) => {
                    const num = variable.replace(/\D/g, '');
                    const exampleValue = template.example_values?.[num] || '';
                    
                    return (
                      <div key={variable}>
                        <Label htmlFor={`var-${num}`} className="text-sm">
                          Variável {variable}
                        </Label>
                        <Input
                          id={`var-${num}`}
                          placeholder={exampleValue || `Valor para ${variable}`}
                          value={variables[num] || ''}
                          onChange={(e) => handleVariableChange(variable, e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            {template.status === 'APPROVED' && onSendTemplate && (
              <>
                <Separator />
                <Button onClick={handleSend} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Usar este Template
                </Button>
              </>
            )}
          </div>

          {/* Right: Preview */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Preview
            </h3>
            <TemplatePreview 
              template={template} 
              variables={variables}
              className="mx-auto"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

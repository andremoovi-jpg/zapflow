import { useState } from 'react';
import { Plus, Trash2, Edit, Copy, Check, X, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCustomFields, CreateCustomFieldInput } from '@/hooks/useCustomFields';
import { useToast } from '@/hooks/use-toast';

const fieldTypes = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'select', label: 'Lista de opções' },
];

export function CustomFieldsTab() {
  const { fields, isLoading, createField, deleteField, isCreating } = useCustomFields();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newField, setNewField] = useState<CreateCustomFieldInput>({
    name: '',
    label: '',
    type: 'text',
    required: false,
    description: '',
  });
  const [selectOptions, setSelectOptions] = useState('');

  const handleCreate = () => {
    if (!newField.label) {
      toast({
        title: 'Campo obrigatório',
        description: 'O nome do campo é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    const fieldData = {
      ...newField,
      name: newField.label, // Será normalizado no hook
      options: newField.type === 'select' ? selectOptions.split('\n').filter(o => o.trim()) : undefined,
    };

    createField(fieldData, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setNewField({
          name: '',
          label: '',
          type: 'text',
          required: false,
          description: '',
        });
        setSelectOptions('');
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: `{{${text}}} copiado para a área de transferência.`,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campos Personalizados</CardTitle>
              <CardDescription>
                Defina os campos que serão recebidos via webhook e usados nos templates
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Campo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Campo Personalizado</DialogTitle>
                  <DialogDescription>
                    Defina um novo campo para receber via webhook
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="label">Nome do Campo *</Label>
                    <Input
                      id="label"
                      placeholder="Ex: Produto, Valor, Origem"
                      value={newField.label}
                      onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Variável no template: <code className="bg-muted px-1 rounded">{`{{${newField.label.toLowerCase().replace(/\s+/g, '_') || 'nome_campo'}}}`}</code>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo</Label>
                    <Select
                      value={newField.type}
                      onValueChange={(value: any) => setNewField({ ...newField, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {newField.type === 'select' && (
                    <div className="space-y-2">
                      <Label htmlFor="options">Opções (uma por linha)</Label>
                      <Textarea
                        id="options"
                        placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                        value={selectOptions}
                        onChange={(e) => setSelectOptions(e.target.value)}
                        rows={4}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="default">Valor Padrão (opcional)</Label>
                    <Input
                      id="default"
                      placeholder="Valor padrão se não informado"
                      value={newField.default_value || ''}
                      onChange={(e) => setNewField({ ...newField, default_value: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Descreva o propósito deste campo"
                      value={newField.description || ''}
                      onChange={(e) => setNewField({ ...newField, description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="required">Campo obrigatório</Label>
                    <Switch
                      id="required"
                      checked={newField.required}
                      onCheckedChange={(checked) => setNewField({ ...newField, required: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate} disabled={isCreating}>
                    {isCreating ? 'Criando...' : 'Criar Campo'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : fields.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Nenhum campo personalizado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie campos para receber dados via webhook e usar nos templates.
              </p>
              <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro campo
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Variável</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Obrigatório</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{field.label}</p>
                        {field.description && (
                          <p className="text-xs text-muted-foreground">{field.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => copyToClipboard(field.name)}
                        className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs font-mono hover:bg-muted/80 transition-colors"
                      >
                        {`{{${field.name}}}`}
                        <Copy className="h-3 w-3" />
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {fieldTypes.find(t => t.value === field.type)?.label || field.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {field.required ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteField(field.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como usar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">1. Envie via Webhook</h4>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`POST /api/webhook/contacts
{
  "name": "João Silva",
  "phone": "5511999999999",
  "custom_fields": {
${fields.map(f => `    "${f.name}": "valor_aqui"`).join(',\n') || '    "campo": "valor"'}
  }
}`}
            </pre>
          </div>
          <div>
            <h4 className="font-medium mb-2">2. Use no Template</h4>
            <p className="text-sm text-muted-foreground mb-2">
              No editor de fluxos, ao configurar um template, use as variáveis:
            </p>
            <div className="flex flex-wrap gap-2">
              <code className="bg-muted px-2 py-1 rounded text-xs">{`{{nome}}`}</code>
              <code className="bg-muted px-2 py-1 rounded text-xs">{`{{telefone}}`}</code>
              {fields.map(f => (
                <code key={f.id} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                  {`{{${f.name}}}`}
                </code>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

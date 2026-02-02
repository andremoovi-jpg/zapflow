import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TagBadge } from './TagBadge';
import { useAllTags } from '@/hooks/useContacts';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ImportCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'mapping' | 'importing' | 'complete';

interface CSVData {
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  phone_number: string;
  name: string;
  email: string;
  tags: string;
}

interface CustomFieldMapping {
  [fieldName: string]: string; // fieldName -> CSV column header
}

const CONTACT_FIELDS = [
  { key: 'phone_number', label: 'Telefone', required: true },
  { key: 'name', label: 'Nome', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'tags', label: 'Tags (separadas por vírgula)', required: false },
];

export function ImportCSVModal({ open, onOpenChange }: ImportCSVModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    phone_number: '',
    name: '',
    email: '',
    tags: '',
  });
  const [customFieldMapping, setCustomFieldMapping] = useState<CustomFieldMapping>({});
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importTags, setImportTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ imported: 0, updated: 0, errors: 0 });

  const { data: allTags = [] } = useAllTags();
  const { fields: customFields = [] } = useCustomFields();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get unmapped CSV columns (for custom fields)
  const unmappedColumns = csvData?.headers.filter(
    (h) =>
      h !== columnMapping.phone_number &&
      h !== columnMapping.name &&
      h !== columnMapping.email &&
      h !== columnMapping.tags &&
      !Object.values(customFieldMapping).includes(h)
  ) || [];

  const resetState = () => {
    setStep('upload');
    setCsvData(null);
    setColumnMapping({ phone_number: '', name: '', email: '', tags: '' });
    setCustomFieldMapping({});
    setUpdateExisting(true);
    setImportTags([]);
    setNewTag('');
    setProgress(0);
    setResult({ imported: 0, updated: 0, errors: 0 });
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetState, 300);
  };

  const parseCSV = useCallback((text: string): CSVData => {
    // Try to detect delimiter (comma or semicolon)
    const firstLine = text.split('\n')[0];
    const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length === 0) {
      throw new Error('Arquivo vazio');
    }

    const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map((line) => {
      // Handle quoted values
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));

      return values;
    });

    return { headers, rows };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = parseCSV(text);
      setCsvData(data);

      // Auto-detect column mapping
      const mapping: ColumnMapping = { phone_number: '', name: '', email: '', tags: '' };
      const cfMapping: CustomFieldMapping = {};

      data.headers.forEach((header) => {
        const lowerHeader = header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Standard fields
        if (lowerHeader.includes('telefone') || lowerHeader.includes('phone') || lowerHeader.includes('celular') || lowerHeader === 'numero') {
          mapping.phone_number = header;
        } else if (lowerHeader.includes('nome') || lowerHeader === 'name') {
          mapping.name = header;
        } else if (lowerHeader.includes('email') || lowerHeader.includes('e-mail')) {
          mapping.email = header;
        } else if (lowerHeader.includes('tag')) {
          mapping.tags = header;
        } else if (customFields && customFields.length > 0) {
          // Try to match with custom fields
          const matchingField = customFields.find((cf) => {
            const cfLower = cf.name.toLowerCase();
            const cfLabelLower = cf.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return cfLower === lowerHeader || cfLabelLower === lowerHeader || cfLower.includes(lowerHeader) || lowerHeader.includes(cfLower);
          });

          if (matchingField) {
            cfMapping[matchingField.name] = header;
          }
        }
      });

      setColumnMapping(mapping);
      setCustomFieldMapping(cfMapping);
      setStep('mapping');
    } catch (error) {
      console.error('Erro ao processar CSV:', error);
      toast({
        title: 'Erro ao ler arquivo',
        description: error instanceof Error ? error.message : 'O arquivo não pôde ser processado. Verifique se é um CSV válido.',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (!csvData || !currentOrg?.id) return;

    setStep('importing');
    setProgress(0);

    let imported = 0;
    let updated = 0;
    let errors = 0;
    const total = csvData.rows.length;

    for (let i = 0; i < csvData.rows.length; i++) {
      const row = csvData.rows[i];
      const getValue = (columnName: string) => {
        const index = csvData.headers.indexOf(columnName);
        return index >= 0 ? row[index] : '';
      };

      const phone = getValue(columnMapping.phone_number);
      if (!phone) {
        errors++;
        continue;
      }

      // Clean phone number
      let cleanPhone = phone.replace(/[^\d+]/g, '');
      if (!cleanPhone.startsWith('+') && !cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
      }
      if (!cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone;
      }

      const name = getValue(columnMapping.name) || null;
      const email = getValue(columnMapping.email) || null;

      // Parse tags from CSV + import tags
      const csvTags = columnMapping.tags
        ? getValue(columnMapping.tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      const allContactTags = [...new Set([...csvTags, ...importTags])];

      // Build custom fields object
      const customFieldsObj: Record<string, string> = {};
      Object.entries(customFieldMapping).forEach(([fieldName, columnHeader]) => {
        const value = getValue(columnHeader);
        if (value) {
          customFieldsObj[fieldName] = value;
        }
      });

      try {
        // Check if contact exists
        const { data: existing } = await supabase
          .from('contacts')
          .select('id, tags, custom_fields')
          .eq('organization_id', currentOrg.id)
          .eq('phone_number', cleanPhone)
          .single();

        if (existing && updateExisting) {
          // Merge tags and custom fields
          const mergedTags = [...new Set([...(existing.tags || []), ...allContactTags])];
          const existingCustomFields = (existing.custom_fields as Record<string, unknown>) || {};
          const mergedCustomFields = { ...existingCustomFields, ...customFieldsObj };

          await supabase
            .from('contacts')
            .update({
              name: name || undefined,
              email: email || undefined,
              tags: mergedTags,
              custom_fields: mergedCustomFields,
            })
            .eq('id', existing.id);
          updated++;
        } else if (!existing) {
          // Create new contact
          await supabase.from('contacts').insert({
            organization_id: currentOrg.id,
            phone_number: cleanPhone,
            name,
            email,
            tags: allContactTags,
            custom_fields: customFieldsObj,
            opted_in: true,
          });
          imported++;
        }
      } catch (error) {
        errors++;
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setResult({ imported, updated, errors });
    setStep('complete');
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['contact-stats'] });
    queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
  };

  const addImportTag = (tag: string) => {
    if (tag.trim() && !importTags.includes(tag.trim())) {
      setImportTags([...importTags, tag.trim()]);
    }
    setNewTag('');
  };

  const toggleExistingTag = (tag: string) => {
    if (importTags.includes(tag)) {
      setImportTags(importTags.filter((t) => t !== tag));
    } else {
      setImportTags([...importTags, tag]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Importar Contatos'}
            {step === 'mapping' && 'Mapear Colunas'}
            {step === 'importing' && 'Importando...'}
            {step === 'complete' && 'Importação Concluída'}
          </DialogTitle>
        </DialogHeader>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-6 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Arraste um arquivo CSV ou clique para selecionar
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Selecionar Arquivo
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Formato esperado:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Arquivo CSV com cabeçalhos na primeira linha</li>
                <li>Coluna de telefone é obrigatória</li>
                <li>Colunas extras podem ser mapeadas para campos personalizados</li>
                <li>Tags podem ser separadas por vírgula na planilha</li>
              </ul>
              <p className="mt-3 text-xs">
                Exemplo: nome, numero, produto, hora, email, tags
              </p>
            </div>
          </div>
        )}

        {/* Mapping Step */}
        {step === 'mapping' && csvData && (
          <div className="space-y-6 py-4">
            {/* Preview */}
            <div>
              <Label className="mb-2 block">Preview (primeiras 3 linhas)</Label>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {csvData.headers.map((header, i) => (
                        <TableHead key={i} className="whitespace-nowrap text-xs">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.rows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j} className="whitespace-nowrap text-xs">
                            {cell.substring(0, 30)}{cell.length > 30 ? '...' : ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total: {csvData.rows.length} linhas
              </p>
            </div>

            {/* Standard Column Mapping */}
            <div>
              <Label className="mb-3 block font-medium">Campos Padrão</Label>
              <div className="grid grid-cols-2 gap-4">
                {CONTACT_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-sm">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Select
                      value={columnMapping[field.key as keyof ColumnMapping] || '__none__'}
                      onValueChange={(value) =>
                        setColumnMapping((prev) => ({ ...prev, [field.key]: value === '__none__' ? '' : value }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecionar coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        {csvData.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Fields Mapping */}
            {customFields.length > 0 && (
              <div>
                <Label className="mb-3 block font-medium">Campos Personalizados</Label>
                <div className="grid grid-cols-2 gap-4">
                  {customFields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <Label className="text-sm">{field.label}</Label>
                      <Select
                        value={customFieldMapping[field.name] || '__none__'}
                        onValueChange={(value) =>
                          setCustomFieldMapping((prev) => ({
                            ...prev,
                            [field.name]: value === '__none__' ? '' : value,
                          }))
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecionar coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma</SelectItem>
                          {csvData.headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmapped Columns Info */}
            {unmappedColumns.length > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Colunas não mapeadas: <span className="font-medium">{unmappedColumns.join(', ')}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Crie campos personalizados em Configurações para mapear essas colunas.
                </p>
              </div>
            )}

            {/* Tags Section */}
            <div className="space-y-3">
              <Label className="block font-medium">Adicionar Tags aos Importados</Label>

              {/* Existing Tags */}
              {allTags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Tags existentes (clique para selecionar)</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={importTags.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors"
                        onClick={() => toggleExistingTag(tag)}
                      >
                        {tag}
                        {importTags.includes(tag) && (
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Import Tags */}
              {importTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {importTags.filter(t => !allTags.includes(t)).map((tag) => (
                    <TagBadge
                      key={tag}
                      tag={tag}
                      onRemove={() => setImportTags(importTags.filter((t) => t !== tag))}
                    />
                  ))}
                </div>
              )}

              {/* Add New Tag */}
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Criar nova tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addImportTag(newTag);
                    }
                  }}
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addImportTag(newTag)}
                  disabled={!newTag.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="updateExisting"
                checked={updateExisting}
                onCheckedChange={(checked) => setUpdateExisting(!!checked)}
              />
              <Label htmlFor="updateExisting" className="font-normal cursor-pointer text-sm">
                Atualizar contatos existentes (mesmo telefone)
              </Label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                className="flex-1"
                disabled={!columnMapping.phone_number}
              >
                Importar {csvData.rows.length} contatos
              </Button>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <div className="py-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-lg font-medium mb-2">Importando contatos...</p>
            <Progress value={progress} className="w-full mb-2" />
            <p className="text-sm text-muted-foreground">{progress}% concluído</p>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="py-8 text-center space-y-6">
            <CheckCircle2 className="h-16 w-16 mx-auto text-success" />
            <div>
              <p className="text-lg font-medium mb-4">Importação concluída!</p>
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                <div className="text-center p-4 rounded-lg bg-success/10">
                  <p className="text-2xl font-bold text-success">{result.imported}</p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-500/10">
                  <p className="text-2xl font-bold text-blue-500">{result.updated}</p>
                  <p className="text-xs text-muted-foreground">Atualizados</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-destructive/10">
                  <p className="text-2xl font-bold text-destructive">{result.errors}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
            </div>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

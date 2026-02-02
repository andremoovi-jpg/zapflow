import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, X, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PhoneInput, isValidPhone } from './PhoneInput';
import { TagBadge } from './TagBadge';
import { useCreateContact, useUpdateContact, useAllTags, Contact } from '@/hooks/useContacts';

const contactSchema = z.object({
  phone_number: z.string().min(10, 'Telefone é obrigatório').refine(isValidPhone, {
    message: 'Formato de telefone inválido',
  }),
  name: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  opted_in: z.boolean(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
}

export function ContactModal({ open, onOpenChange, contact }: ContactModalProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const { data: allTags = [] } = useAllTags();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();

  const isEditing = !!contact;
  const isLoading = createContact.isPending || updateContact.isPending;

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      phone_number: '',
      name: '',
      email: '',
      opted_in: true,
    },
  });

  useEffect(() => {
    if (contact) {
      form.reset({
        phone_number: contact.phone_number,
        name: contact.name ?? '',
        email: contact.email ?? '',
        opted_in: contact.opted_in,
      });
      setTags(contact.tags || []);
      setCustomFields(
        Object.entries(contact.custom_fields || {}).map(([key, value]) => ({
          key,
          value: String(value),
        }))
      );
    } else {
      form.reset({
        phone_number: '',
        name: '',
        email: '',
        opted_in: true,
      });
      setTags([]);
      setCustomFields([]);
    }
  }, [contact, form]);

  const handleSubmit = async (data: ContactFormData) => {
    const customFieldsObj = customFields.reduce(
      (acc, { key, value }) => {
        if (key.trim()) {
          acc[key.trim()] = value;
        }
        return acc;
      },
      {} as Record<string, string>
    );

    const payload = {
      phone_number: data.phone_number,
      name: data.name || null,
      email: data.email || null,
      tags,
      custom_fields: customFieldsObj,
      opted_in: data.opted_in,
    };

    if (isEditing && contact) {
      await updateContact.mutateAsync({ id: contact.id, ...payload });
    } else {
      await createContact.mutateAsync(payload);
    }

    onOpenChange(false);
  };

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
    }
    setNewTag('');
    setShowTagSuggestions(false);
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const filteredTagSuggestions = allTags.filter(
    (tag) =>
      tag.toLowerCase().includes(newTag.toLowerCase()) && !tags.includes(tag)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 mt-4">
          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone_number">
              Telefone <span className="text-destructive">*</span>
            </Label>
            <PhoneInput
              value={form.watch('phone_number')}
              onChange={(value) => form.setValue('phone_number', value)}
              error={!!form.formState.errors.phone_number}
            />
            {form.formState.errors.phone_number && (
              <p className="text-sm text-destructive">
                {form.formState.errors.phone_number.message}
              </p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" placeholder="Nome do contato" {...form.register('name')} />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <TagBadge key={tag} tag={tag} onRemove={() => removeTag(tag)} />
              ))}
            </div>
            <div className="relative">
              <Input
                placeholder="Adicionar tag..."
                value={newTag}
                onChange={(e) => {
                  setNewTag(e.target.value);
                  setShowTagSuggestions(true);
                }}
                onFocus={() => setShowTagSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newTag.trim()) {
                      addTag(newTag);
                    }
                  }
                }}
              />
              {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-auto">
                  {filteredTagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => addTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Custom Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Campos Customizados</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addCustomField}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
            {customFields.map((field, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Campo"
                  value={field.key}
                  onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Valor"
                  value={field.value}
                  onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCustomField(index)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          {/* Opted In */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="opted_in"
              checked={form.watch('opted_in')}
              onCheckedChange={(checked) => form.setValue('opted_in', !!checked)}
            />
            <Label htmlFor="opted_in" className="font-normal cursor-pointer">
              Aceita receber mensagens
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEditing ? (
                'Salvar'
              ) : (
                'Criar Contato'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

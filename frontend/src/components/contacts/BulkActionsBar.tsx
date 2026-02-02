import { useState } from 'react';
import { Tag, Trash2, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useBulkUpdateTags, useDeleteContacts, Contact } from '@/hooks/useContacts';

interface BulkActionsBarProps {
  selectedIds: string[];
  contacts: Contact[];
  onClearSelection: () => void;
  availableTags: string[];
}

export function BulkActionsBar({
  selectedIds,
  contacts,
  onClearSelection,
  availableTags,
}: BulkActionsBarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [showRemoveTag, setShowRemoveTag] = useState(false);
  const [newTag, setNewTag] = useState('');

  const bulkUpdateTags = useBulkUpdateTags();
  const deleteContacts = useDeleteContacts();

  // Get all tags from selected contacts
  const selectedContactsTags = new Set<string>();
  contacts
    .filter((c) => selectedIds.includes(c.id))
    .forEach((c) => c.tags?.forEach((t) => selectedContactsTags.add(t)));

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;
    bulkUpdateTags.mutate(
      { ids: selectedIds, tags: [tag.trim()], action: 'add' },
      {
        onSuccess: () => {
          setShowAddTag(false);
          setNewTag('');
        },
      }
    );
  };

  const handleRemoveTag = (tag: string) => {
    bulkUpdateTags.mutate(
      { ids: selectedIds, tags: [tag], action: 'remove' },
      {
        onSuccess: () => {
          setShowRemoveTag(false);
        },
      }
    );
  };

  const handleDelete = () => {
    deleteContacts.mutate(selectedIds, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        onClearSelection();
      },
    });
  };

  const handleExport = () => {
    const selectedContacts = contacts.filter((c) => selectedIds.includes(c.id));

    const headers = ['Nome', 'Telefone', 'Email', 'Tags', 'Opt-in', 'Criado em'];
    const rows = selectedContacts.map((c) => [
      c.name || '',
      c.phone_number,
      c.email || '',
      c.tags?.join('; ') || '',
      c.opted_in ? 'Sim' : 'Não',
      new Date(c.created_at).toLocaleDateString('pt-BR'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contatos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <span className="text-sm font-medium">
          {selectedIds.length} selecionado(s)
        </span>
        <div className="h-4 w-px bg-border" />

        {/* Add Tag */}
        <Popover open={showAddTag} onOpenChange={setShowAddTag}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Tag className="h-4 w-4 mr-2" />
              Adicionar Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <Input
                placeholder="Nova tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTag(newTag);
                  }
                }}
              />
              {availableTags.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="w-full text-left px-2 py-1 text-sm rounded hover:bg-accent"
                      onClick={() => handleAddTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleAddTag(newTag)}
                disabled={!newTag.trim()}
              >
                Adicionar
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Remove Tag */}
        {selectedContactsTags.size > 0 && (
          <Popover open={showRemoveTag} onOpenChange={setShowRemoveTag}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <X className="h-4 w-4 mr-2" />
                Remover Tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {Array.from(selectedContactsTags).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="w-full text-left px-2 py-1 text-sm rounded hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Export */}
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>

        {/* Delete */}
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir
        </Button>

        {/* Clear Selection */}
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Limpar seleção
        </Button>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contatos?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir {selectedIds.length} contato(s). Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

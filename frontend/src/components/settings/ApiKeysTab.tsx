import { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Copy, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '@/hooks/useApiKeys';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const permissions = [
  { id: 'read_contacts', label: 'Ler contatos' },
  { id: 'create_contacts', label: 'Criar contatos' },
  { id: 'send_messages', label: 'Enviar mensagens' },
  { id: 'read_conversations', label: 'Ler conversas' },
  { id: 'manage_flows', label: 'Gerenciar fluxos' },
  { id: 'manage_campaigns', label: 'Gerenciar campanhas' },
];

export function ApiKeysTab() {
  const { data: apiKeys, isLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newKeyName || selectedPermissions.length === 0) {
      toast.error('Preencha o nome e selecione pelo menos uma permissão');
      return;
    }

    const result = await createApiKey.mutateAsync({
      name: newKeyName,
      permissions: selectedPermissions,
    });

    setCreatedKey(result.rawKey);
    setNewKeyName('');
    setSelectedPermissions([]);
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      toast.success('Chave copiada!');
    }
  };

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
    setCreatedKey(null);
    setShowKey(false);
    setNewKeyName('');
    setSelectedPermissions([]);
  };

  const handleDelete = async () => {
    if (!deleteKeyId) return;
    await deleteApiKey.mutateAsync(deleteKeyId);
    setDeleteKeyId(null);
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Chaves de API</CardTitle>
              <CardDescription>
                Gerencie suas chaves de API para integrações externas
              </CardDescription>
            </div>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Chave
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
          ) : apiKeys?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma chave de API criada
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys?.map(key => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{key.name}</p>
                      <code className="text-xs px-2 py-0.5 rounded bg-muted font-mono">
                        {key.key_prefix}...
                      </code>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Criada {formatDistanceToNow(new Date(key.created_at), { addSuffix: true, locale: ptBR })}
                      {key.last_used_at && (
                        <> • Último uso {formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true, locale: ptBR })}</>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteKeyId(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      <Dialog open={createModalOpen} onOpenChange={handleCloseCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createdKey ? 'Chave Criada com Sucesso!' : 'Criar Chave de API'}
            </DialogTitle>
            {createdKey && (
              <DialogDescription>
                Copie esta chave agora. Ela não será exibida novamente.
              </DialogDescription>
            )}
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    type={showKey ? 'text' : 'password'}
                    value={createdKey}
                    className="font-mono text-sm flex-1"
                  />
                  <Button size="icon" variant="outline" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="outline" onClick={handleCopyKey}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button className="w-full" onClick={handleCloseCreateModal}>
                Fechar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Nome da Chave</Label>
                <Input
                  id="keyName"
                  placeholder="Ex: Integração CRM"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                <Label>Permissões</Label>
                {permissions.map(perm => (
                  <div key={perm.id} className="flex items-center gap-3">
                    <Checkbox
                      id={perm.id}
                      checked={selectedPermissions.includes(perm.id)}
                      onCheckedChange={() => togglePermission(perm.id)}
                    />
                    <label htmlFor={perm.id} className="text-sm cursor-pointer">
                      {perm.label}
                    </label>
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createApiKey.isPending}
              >
                {createApiKey.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Chave'
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={(open) => !open && setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar chave?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as integrações usando esta chave deixarão de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

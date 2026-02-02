import { useState } from 'react';
import { Plus, Settings, TestTube2, Trash2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWhatsAppAccounts, useDeleteWABA } from '@/hooks/useWhatsAppAccounts';
import { ConnectWABAModal } from './ConnectWABAModal';
import { ConfigureWABAModal } from './ConfigureWABAModal';
import type { WhatsAppAccount } from '@/contexts/WABAContext';
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
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { color: string; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { color: 'bg-green-500', label: 'Ativa', variant: 'default' },
  degraded: { color: 'bg-yellow-500', label: 'Degradada', variant: 'secondary' },
  suspended: { color: 'bg-red-500', label: 'Suspensa', variant: 'destructive' },
  pending: { color: 'bg-gray-400', label: 'Pendente', variant: 'outline' },
};

export function WhatsAppAccountsTab() {
  const { data: accounts, isLoading, refetch } = useWhatsAppAccounts();
  const deleteWABA = useDeleteWABA();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [configureWABA, setConfigureWABA] = useState<WhatsAppAccount | null>(null);
  const [deleteWABAId, setDeleteWABAId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteWABAId) return;
    await deleteWABA.mutateAsync(deleteWABAId);
    setDeleteWABAId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contas WhatsApp (WABA)</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie suas contas WhatsApp Business
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={() => setConnectModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Conectar Conta
          </Button>
        </div>
      </div>

      {accounts?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <WifiOff className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Nenhuma conta conectada</h3>
            <p className="text-muted-foreground mb-4">
              Conecte sua conta WhatsApp Business para começar
            </p>
            <Button onClick={() => setConnectModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Conectar Conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {accounts?.map((account) => {
            const status = statusConfig[account.status] || statusConfig.pending;

            return (
              <Card key={account.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center',
                        account.status === 'active' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
                      )}>
                        <Wifi className={cn(
                          'h-6 w-6',
                          account.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{account.name}</h3>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>WABA ID: {account.waba_id}</p>
                          {account.business_manager_id && (
                            <p>Business Manager: {account.business_manager_id}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setConfigureWABA(account)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar
                      </Button>
                      <Button variant="outline" size="sm">
                        <TestTube2 className="h-4 w-4 mr-2" />
                        Testar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteWABAId(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>


                  {account.last_error_message && (
                    <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <strong>Último erro:</strong> {account.last_error_message}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConnectWABAModal 
        open={connectModalOpen} 
        onOpenChange={setConnectModalOpen} 
      />

      {configureWABA && (
        <ConfigureWABAModal
          waba={configureWABA}
          open={!!configureWABA}
          onOpenChange={(open) => !open && setConfigureWABA(null)}
        />
      )}

      <AlertDialog open={!!deleteWABAId} onOpenChange={(open) => !open && setDeleteWABAId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados associados a esta conta serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

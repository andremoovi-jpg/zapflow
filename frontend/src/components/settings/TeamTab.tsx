import { useState } from 'react';
import { Users, Plus, Trash2, Shield, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useTeamMembers, useUpdateMemberRole, useRemoveMember } from '@/hooks/useTeamMembers';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  member: 'Membro',
  viewer: 'Visualizador',
};

const roleColors: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  member: 'secondary',
  viewer: 'outline',
};

export function TeamTab() {
  const { user } = useAuth();
  const { data: members, isLoading } = useTeamMembers();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member');
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);

  const handleInvite = () => {
    // In production, this would send an invite email
    toast.success(`Convite enviado para ${inviteEmail}`);
    setInviteModalOpen(false);
    setInviteEmail('');
    setInviteRole('member');
  };

  const handleRoleChange = async (memberId: string, role: 'admin' | 'member' | 'viewer') => {
    await updateRole.mutateAsync({ memberId, role });
  };

  const handleRemove = async () => {
    if (!deleteMemberId) return;
    await removeMember.mutateAsync(deleteMemberId);
    setDeleteMemberId(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Membros da Equipe
              </CardTitle>
              <CardDescription>
                Gerencie quem tem acesso à sua organização
              </CardDescription>
            </div>
            <Button onClick={() => setInviteModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Convidar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {members?.map((member) => {
                const isCurrentUser = member.user_id === user?.id;
                const profile = member.profile;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {profile?.full_name?.split(' ').map(n => n[0]).join('') || 
                           profile?.email?.[0].toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {profile?.full_name || 'Sem nome'}
                            {isCurrentUser && ' (você)'}
                          </p>
                          <Badge variant={roleColors[member.role]}>
                            {roleLabels[member.role]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {profile?.email || 'Email não disponível'}
                        </p>
                      </div>
                    </div>
                    {!isCurrentUser && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={member.role}
                          onValueChange={(v) => handleRoleChange(member.id, v as 'admin' | 'member' | 'viewer')}
                          disabled={updateRole.isPending}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Membro</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteMemberId(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role descriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Níveis de Permissão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Badge>Admin</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Acesso total. Pode gerenciar membros, contas WhatsApp, configurações e faturamento.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">Membro</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Pode gerenciar contatos, conversas, fluxos e campanhas. Sem acesso a configurações.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">Visualizador</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Apenas visualização. Pode ver conversas e relatórios, mas não pode fazer alterações.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissão</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as 'member' | 'viewer')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleInvite} disabled={!inviteEmail}>
              <Mail className="h-4 w-4 mr-2" />
              Enviar Convite
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!deleteMemberId} onOpenChange={(open) => !open && setDeleteMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Este membro perderá acesso a todos os recursos da organização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
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

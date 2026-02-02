import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Pencil, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TagBadge } from '@/components/contacts/TagBadge';
import { ContactModal } from '@/components/contacts/ContactModal';
import { useContact, useDeleteContacts, useUpdateContact } from '@/hooks/useContacts';
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

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: contact, isLoading } = useContact(id);
  const deleteContacts = useDeleteContacts();
  const updateContact = useUpdateContact();

  const handleDelete = () => {
    if (!id) return;
    deleteContacts.mutate([id], {
      onSuccess: () => navigate('/contacts'),
    });
  };

  const handleRemoveTag = (tag: string) => {
    if (!contact) return;
    const newTags = contact.tags.filter((t) => t !== tag);
    updateContact.mutate({ id: contact.id, tags: newTags });
  };

  if (isLoading) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Contatos', href: '/contacts' }, { label: 'Carregando...' }]}>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!contact) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Contatos', href: '/contacts' }, { label: 'Não encontrado' }]}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Contato não encontrado</p>
          <Button className="mt-4" onClick={() => navigate('/contacts')}>Voltar</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Contatos', href: '/contacts' }, { label: contact.name || contact.phone_number }]}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {(contact.name || contact.phone_number).slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">{contact.name || 'Sem nome'}</h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {contact.phone_number}
                </p>
                {contact.email && (
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {contact.email}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/inbox')}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Enviar Mensagem
            </Button>
            <Button variant="outline" onClick={() => setShowEditModal(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {contact.tags?.map((tag) => (
            <TagBadge key={tag} tag={tag} size="md" onRemove={() => handleRemoveTag(tag)} />
          ))}
          {(!contact.tags || contact.tags.length === 0) && (
            <span className="text-sm text-muted-foreground">Nenhuma tag</span>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="space-y-4">
          <TabsList>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="conversations">Conversas</TabsTrigger>
            <TabsTrigger value="flows">Histórico de Fluxos</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>Dados Cadastrais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{contact.opted_in ? 'Opt-in (aceita mensagens)' : 'Opt-out'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Criado em</p>
                    <p className="font-medium">{format(new Date(contact.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Última interação</p>
                    <p className="font-medium">
                      {contact.last_interaction_at
                        ? formatDistanceToNow(new Date(contact.last_interaction_at), { addSuffix: true, locale: ptBR })
                        : 'Nunca'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estado no fluxo</p>
                    <p className="font-medium">{contact.conversation_state || 'Nenhum'}</p>
                  </div>
                </div>

                {Object.keys(contact.custom_fields || {}).length > 0 && (
                  <>
                    <hr className="my-4" />
                    <div>
                      <p className="text-sm font-medium mb-2">Campos Customizados</p>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(contact.custom_fields).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-sm text-muted-foreground">{key}</p>
                            <p className="font-medium">{String(value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversations">
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma conversa encontrada
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flows">
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma execução de fluxo encontrada
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Timeline vazia
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ContactModal open={showEditModal} onOpenChange={setShowEditModal} contact={contact} />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O contato será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

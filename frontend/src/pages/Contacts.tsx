import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreHorizontal, Phone, Mail, Eye, Pencil, Trash2, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { ContactModal } from '@/components/contacts/ContactModal';
import { ImportCSVModal } from '@/components/contacts/ImportCSVModal';
import { ContactFilters } from '@/components/contacts/ContactFilters';
import { BulkActionsBar } from '@/components/contacts/BulkActionsBar';
import { TagBadge } from '@/components/contacts/TagBadge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyContacts } from '@/components/ui/empty-state';
import {
  useContacts,
  useContactStats,
  useAllTags,
  useDeleteContacts,
  ContactFilters as ContactFiltersType,
  Contact,
} from '@/hooks/useContacts';

export default function Contacts() {
  const navigate = useNavigate();
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [filters, setFilters] = useState<ContactFiltersType>({});
  const [page, setPage] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: contactsData, isLoading } = useContacts(filters, page);
  const { data: stats } = useContactStats();
  const { data: allTags = [] } = useAllTags();
  const deleteContacts = useDeleteContacts();

  const contacts = contactsData?.data ?? [];
  const totalCount = contactsData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);
  const hasContacts = contacts.length > 0 || Object.keys(filters).length > 0;

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedContacts((prev) =>
      prev.length === contacts.length ? [] : contacts.map((c) => c.id)
    );
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setShowContactModal(true);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteContacts.mutate([deleteConfirm]);
      setDeleteConfirm(null);
    }
  };

  const formatPhone = (phone: string) => {
    if (phone.startsWith('+55') && phone.length >= 13) {
      return `+55 ${phone.slice(3, 5)} ${phone.slice(5, 10)}-${phone.slice(10)}`;
    }
    return phone;
  };

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Contatos' }]}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contatos</h1>
            <p className="text-muted-foreground">Gerencie seus contatos e leads</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              Importar CSV
            </Button>
            <Button onClick={() => { setEditingContact(null); setShowContactModal(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Contato
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total de Contatos', value: stats?.total ?? 0 },
            { label: 'Ativos (7 dias)', value: stats?.recentlyActive ?? 0 },
            { label: 'Opt-in', value: stats?.optedIn ?? 0 },
            { label: 'Novos (7 dias)', value: stats?.newContacts ?? 0 },
          ].map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="space-y-4">
              <ContactFilters filters={filters} onFiltersChange={setFilters} availableTags={allTags} />
              <BulkActionsBar
                selectedIds={selectedContacts}
                contacts={contacts}
                onClearSelection={() => setSelectedContacts([])}
                availableTags={allTags}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={contacts.length > 0 && selectedContacts.length === contacts.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Última Interação</TableHead>
                  <TableHead>Opt-in</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : !hasContacts ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyContacts onAdd={() => { setEditingContact(null); setShowContactModal(true); }} />
                    </TableCell>
                  </TableRow>
                ) : contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum contato encontrado com esses filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/contacts/${contact.id}`)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedContacts.includes(contact.id)} onCheckedChange={() => toggleContact(contact.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {(contact.name || contact.phone_number).slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{contact.name || 'Sem nome'}</p>
                            <p className="text-sm text-muted-foreground">{contact.email || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatPhone(contact.phone_number)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {contact.tags?.slice(0, 3).map((tag) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                          {(contact.tags?.length ?? 0) > 3 && (
                            <span className="text-xs text-muted-foreground">+{contact.tags!.length - 3}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contact.last_interaction_at
                          ? formatDistanceToNow(new Date(contact.last_interaction_at), { addSuffix: true, locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${contact.opted_in ? 'badge-success' : 'bg-muted text-muted-foreground'}`}>
                          {contact.opted_in ? 'Sim' : 'Não'}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => navigate(`/contacts/${contact.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(contact)}>
                            <Pencil className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(contact.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Mostrando {page * 20 + 1}-{Math.min((page + 1) * 20, totalCount)} de {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ContactModal open={showContactModal} onOpenChange={setShowContactModal} contact={editingContact} />
      <ImportCSVModal open={showImportModal} onOpenChange={setShowImportModal} />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Excluir contato"
        description="Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
        loading={deleteContacts.isPending}
      />
    </DashboardLayout>
  );
}

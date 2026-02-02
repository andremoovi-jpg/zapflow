import { useState } from 'react';
import { ChevronRight, Plus, X, Edit2, History, MessageSquare, StopCircle } from 'lucide-react';
import { useStopContactFlows } from '@/hooks/useStopContactFlows';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Conversation } from '@/hooks/useConversations';
import { TagBadge } from '@/components/contacts/TagBadge';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ContactSidebarProps {
  conversation: Conversation | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ContactSidebar({ conversation, isOpen, onClose }: ContactSidebarProps) {
  const navigate = useNavigate();
  const [newTag, setNewTag] = useState('');
  const [tags, setTags] = useState<string[]>(conversation?.contact?.tags || []);
  const [notes, setNotes] = useState('');
  const stopFlows = useStopContactFlows();

  if (!conversation || !isOpen) return null;

  const contact = conversation.contact;

  const getInitials = (name: string | null | undefined, phone: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return phone.slice(-2);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
      // TODO: Update in database
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
    // TODO: Update in database
  };

  const customFields = contact?.custom_fields as Record<string, unknown> || {};

  return (
    <div className={cn(
      'w-72 border-l border-border bg-card flex flex-col',
      'hidden xl:flex'
    )}>
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4">
        <span className="font-medium">Detalhes do Contato</span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Avatar and Name */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-semibold text-primary">
                {getInitials(contact?.name, contact?.phone_number || '')}
              </span>
            </div>
            <h3 className="font-semibold">{contact?.name || 'Sem nome'}</h3>
            <p className="text-sm text-muted-foreground">{contact?.phone_number}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => navigate(`/contacts/${contact?.id}`)}
            >
              Ver perfil completo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <Separator />

          {/* Tags */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              Tags
            </p>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((tag) => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  onRemove={() => handleRemoveTag(tag)}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <Input
                placeholder="Nova tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="text-sm h-8"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button size="sm" variant="outline" onClick={handleAddTag}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Custom Fields */}
          {Object.keys(customFields).length > 0 && (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Campos Personalizados
                </p>
                <div className="space-y-2">
                  {Object.entries(customFields).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{key}</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Quick Actions */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              Ações Rápidas
            </p>
            <div className="space-y-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => navigate(`/contacts/${contact?.id}?tab=conversations`)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Ver todas as conversas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => navigate(`/contacts/${contact?.id}?tab=history`)}
              >
                <History className="h-4 w-4 mr-2" />
                Histórico de fluxos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => contact?.id && stopFlows.mutate(contact.id)}
                disabled={stopFlows.isPending}
              >
                <StopCircle className="h-4 w-4 mr-2" />
                {stopFlows.isPending ? 'Parando...' : 'Parar todos os fluxos'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Internal Notes */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              Notas Internas
            </p>
            <Textarea
              placeholder="Adicione notas sobre este contato..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm resize-none"
              rows={3}
            />
          </div>

          {/* Info */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              Informações
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs',
                  conversation.status === 'open' && 'badge-success',
                  conversation.status === 'pending' && 'badge-warning',
                  conversation.status === 'closed' && 'bg-muted text-muted-foreground'
                )}>
                  {conversation.status === 'open' && 'Aberta'}
                  {conversation.status === 'pending' && 'Aguardando'}
                  {conversation.status === 'closed' && 'Fechada'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criada em</span>
                <span>
                  {conversation.created_at 
                    ? format(new Date(conversation.created_at), 'dd/MM/yyyy', { locale: ptBR })
                    : '-'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última mensagem</span>
                <span>
                  {conversation.last_message_at
                    ? formatDistanceToNow(new Date(conversation.last_message_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })
                    : '-'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

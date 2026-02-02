import { Search, Filter, Circle, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Conversation, ConversationFilter } from '@/hooks/useConversations';
import { PhoneNumberWithWaba } from '@/hooks/useWhatsAppAccounts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  filter: ConversationFilter;
  onFilterChange: (filter: ConversationFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  isLoading?: boolean;
  phoneNumbers?: PhoneNumberWithWaba[];
  selectedPhoneId: string | null;
  onPhoneChange: (phoneId: string | null) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  isLoading,
  phoneNumbers = [],
  selectedPhoneId,
  onPhoneChange,
}: ConversationListProps) {
  const filters: { value: ConversationFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'open', label: 'Abertas' },
    { value: 'pending', label: 'Aguardando' },
    { value: 'closed', label: 'Fechadas' },
  ];

  const getInitials = (name: string | null | undefined, phone: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return phone.slice(-2);
  };

  const getLastMessagePreview = (conv: Conversation) => {
    // In a real app, you'd fetch the last message content
    return 'Última mensagem...';
  };

  const isWindowActive = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) > new Date();
  };

  return (
    <div className="w-80 border-r border-border flex flex-col bg-card">
      {/* Search Header */}
      <div className="p-4 border-b border-border space-y-3">
        {/* Phone Number Selector */}
        {phoneNumbers.length > 0 && (
          <Select
            value={selectedPhoneId || 'all'}
            onValueChange={(value) => onPhoneChange(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-full bg-muted/50 border-0">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Todas as contas" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {phoneNumbers.map((phone) => (
                <SelectItem key={phone.id} value={phone.id}>
                  <span className="font-medium">{phone.display_name || phone.phone_number}</span>
                  <span className="text-muted-foreground ml-2 text-xs">({phone.waba_name})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-muted/50 border-0"
          />
        </div>
        <div className="flex gap-1">
          {filters.map(f => (
            <Button
              key={f.value}
              variant={filter === f.value ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => onFilterChange(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={cn(
                'p-4 border-b border-border/50 cursor-pointer transition-colors',
                selectedId === conv.id
                  ? 'bg-accent'
                  : 'hover:bg-muted/50'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {getInitials(conv.contact?.name, conv.contact?.phone_number || '')}
                    </span>
                  </div>
                  {(conv.unread_count ?? 0) > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-primary-foreground">
                        {conv.unread_count}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="font-medium truncate">
                        {conv.contact?.name || conv.contact?.phone_number}
                      </p>
                      {isWindowActive(conv.window_expires_at) && (
                        <Circle className="w-2.5 h-2.5 fill-success text-success flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {conv.last_message_at 
                        ? formatDistanceToNow(new Date(conv.last_message_at), { 
                            addSuffix: false, 
                            locale: ptBR 
                          })
                        : ''}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {getLastMessagePreview(conv)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

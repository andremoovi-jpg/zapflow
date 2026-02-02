import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, MoreVertical, User, X, FileText, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Conversation, Message, useSendMessage, useUpdateConversationStatus } from '@/hooks/useConversations';
import { MessageBubble } from './MessageBubble';
import { differenceInHours, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { WHATSAPP_LIMITS, getCharCounterProps } from '@/lib/whatsappLimits';

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  isLoading?: boolean;
  onOpenTemplateModal: () => void;
}

function WindowStatus({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <Clock className="w-3 h-3" />
        Expirada
      </span>
    );
  }

  const remaining = differenceInHours(new Date(expiresAt), new Date());

  if (remaining <= 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <Clock className="w-3 h-3" />
        Expirada
      </span>
    );
  }
  
  if (remaining <= 4) {
    return (
      <span className="flex items-center gap-1 text-xs text-warning">
        <Clock className="w-3 h-3" />
        {remaining}h restantes
      </span>
    );
  }
  
  return (
    <span className="flex items-center gap-1 text-xs text-success">
      <Clock className="w-3 h-3" />
      {remaining}h restantes
    </span>
  );
}

export function ChatArea({ 
  conversation, 
  messages, 
  isLoading,
  onOpenTemplateModal,
}: ChatAreaProps) {
  const [messageInput, setMessageInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const sendMessage = useSendMessage();
  const updateStatus = useUpdateConversationStatus();

  const isWindowActive = conversation?.window_expires_at 
    ? new Date(conversation.window_expires_at) > new Date()
    : false;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!messageInput.trim() || !conversation) return;

    try {
      await sendMessage.mutateAsync({
        conversationId: conversation.id,
        contactId: conversation.contact_id,
        content: { text: messageInput.trim() },
        type: 'text',
      });
      setMessageInput('');
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCloseConversation = async () => {
    if (!conversation) return;
    try {
      await updateStatus.mutateAsync({ id: conversation.id, status: 'closed' });
      toast.success('Conversa fechada');
    } catch (error) {
      toast.error('Erro ao fechar conversa');
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Selecione uma conversa para começar</p>
        </div>
      </div>
    );
  }

  const getInitials = (name: string | null | undefined, phone: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return phone.slice(-2);
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = '';
  
  messages.forEach(msg => {
    const msgDate = msg.created_at 
      ? format(new Date(msg.created_at), 'yyyy-MM-dd')
      : '';
    
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({
        date: msgDate,
        messages: [msg],
      });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  });

  const formatDateHeader = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return 'Hoje';
    }
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return 'Ontem';
    }
    return format(date, "d 'de' MMMM", { locale: ptBR });
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Chat Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {getInitials(conversation.contact?.name, conversation.contact?.phone_number || '')}
            </span>
          </div>
          <div>
            <p className="font-medium">
              {conversation.contact?.name || conversation.contact?.phone_number}
            </p>
            <WindowStatus expiresAt={conversation.window_expires_at} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(`/contacts/${conversation.contact_id}`)}
          >
            <User className="h-4 w-4 mr-1" />
            Ver contato
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCloseConversation}>
                <X className="h-4 w-4 mr-2" />
                Fechar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef}>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                <Skeleton className="h-16 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <p className="text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div className="flex justify-center my-4">
                  <span className="px-3 py-1 text-xs bg-muted rounded-full text-muted-foreground">
                    {formatDateHeader(group.date)}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-card">
        {isWindowActive ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <Smile className="h-5 w-5" />
            </Button>
            <div className="relative flex-1">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value.slice(0, WHATSAPP_LIMITS.TEXT_MESSAGE))}
                onKeyDown={handleKeyPress}
                placeholder="Digite sua mensagem..."
                className="pr-16"
                maxLength={WHATSAPP_LIMITS.TEXT_MESSAGE}
              />
              {messageInput.length > 0 && (
                <span className={cn(
                  'absolute top-1/2 right-2 -translate-y-1/2 text-xs',
                  getCharCounterProps(messageInput, WHATSAPP_LIMITS.TEXT_MESSAGE).className
                )}>
                  {getCharCounterProps(messageInput, WHATSAPP_LIMITS.TEXT_MESSAGE).text}
                </span>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-shrink-0"
              onClick={onOpenTemplateModal}
            >
              <FileText className="h-4 w-4 mr-1" />
              Template
            </Button>
            <Button 
              size="icon" 
              className="flex-shrink-0"
              onClick={handleSend}
              disabled={!messageInput.trim() || sendMessage.isPending}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Janela de 24h expirada. Envie um template para reabrir.
            </p>
            <Button size="sm" onClick={onOpenTemplateModal}>
              <FileText className="h-4 w-4 mr-1" />
              Enviar Template
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

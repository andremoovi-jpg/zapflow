import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MessageSquare, ArrowRight } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface PendingConversation {
  id: string;
  contact_name: string;
  phone_number: string;
  last_message_at: string;
  unread_count: number;
  hours_waiting: number;
}

interface PendingConversationsListProps {
  data: PendingConversation[];
  loading?: boolean;
}

export function PendingConversationsList({ data, loading }: PendingConversationsListProps) {
  const navigate = useNavigate();

  const getUrgencyColor = (hours: number) => {
    if (hours >= 8) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (hours >= 4) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Aguardando Resposta</CardTitle>
        {data.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/inbox')}
            className="text-primary"
          >
            Ver todas
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-4 p-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Todas as conversas respondidas!</p>
          </div>
        ) : (
          <ScrollArea className="h-[250px]">
            <div className="space-y-1 p-4">
              {data.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => navigate(`/inbox?conversation=${conversation.id}`)}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-sm font-semibold text-primary">
                      {conversation.contact_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{conversation.contact_name}</p>
                      {conversation.unread_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {conversation.unread_count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conversation.phone_number}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge 
                      variant="outline" 
                      className={getUrgencyColor(conversation.hours_waiting)}
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      {Math.round(conversation.hours_waiting)}h
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(parseISO(conversation.last_message_at), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

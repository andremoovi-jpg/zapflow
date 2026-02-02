import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, GitBranch, Send } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Activity {
  type: 'conversation' | 'flow' | 'campaign';
  id: string;
  title: string;
  description: string;
  created_at: string;
}

interface RecentActivityListProps {
  data: Activity[];
  loading?: boolean;
}

const typeIcons = {
  conversation: MessageSquare,
  flow: GitBranch,
  campaign: Send,
};

const typeColors = {
  conversation: 'bg-blue-500/10 text-blue-500',
  flow: 'bg-purple-500/10 text-purple-500',
  campaign: 'bg-green-500/10 text-green-500',
};

export function RecentActivityList({ data, loading }: RecentActivityListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-4 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 animate-pulse rounded bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Nenhuma atividade recente
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-1 p-4">
              {data.map((activity) => {
                const Icon = typeIcons[activity.type];
                const colorClass = typeColors[activity.type];
                
                return (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                  >
                    <div className={cn("rounded-lg p-2", colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(parseISO(activity.created_at), { 
                          addSuffix: true,
                          locale: ptBR 
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

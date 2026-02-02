import { ChevronDown, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWABA, WhatsAppAccount } from '@/contexts/WABAContext';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  active: 'text-green-500',
  degraded: 'text-yellow-500',
  suspended: 'text-red-500',
  pending: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  degraded: 'Degradada',
  suspended: 'Suspensa',
  pending: 'Pendente',
  unknown: 'Desconhecido',
};

export function WABASelector() {
  const { selectedWABA, setSelectedWABA, availableWABAs, loading } = useWABA();

  if (loading || availableWABAs.length === 0) {
    return null;
  }

  // Don't show selector if only one WABA
  if (availableWABAs.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
        <Circle className={cn('h-2 w-2 fill-current', statusColors[selectedWABA?.status || 'unknown'])} />
        <span className="text-sm font-medium truncate max-w-[140px]">
          {selectedWABA?.name}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <Circle className={cn('h-2 w-2 fill-current', statusColors[selectedWABA?.status || 'unknown'])} />
          <span className="truncate max-w-[140px]">{selectedWABA?.name || 'Selecionar conta'}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Contas WhatsApp</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableWABAs.map((waba) => (
          <DropdownMenuItem
            key={waba.id}
            onClick={() => setSelectedWABA(waba)}
            className="flex items-center gap-3"
          >
            <Circle className={cn('h-2 w-2 fill-current', statusColors[waba.status])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{waba.name}</p>
              <p className="text-xs text-muted-foreground">
                {statusLabels[waba.status]} • {waba.messages_sent_today.toLocaleString()}/{waba.rate_limit_per_day.toLocaleString()} hoje
              </p>
            </div>
            {selectedWABA?.id === waba.id && (
              <div className="h-2 w-2 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

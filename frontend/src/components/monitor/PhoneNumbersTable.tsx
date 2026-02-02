import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhoneWithMetrics {
  id: string;
  phone_number: string;
  display_name: string | null;
  status: string | null;
  quality_rating: string | null;
  todayMetrics?: {
    messages_sent: number;
    messages_delivered: number;
    messages_failed: number;
    max_throughput_achieved: number | null;
  } | null;
}

interface PhoneNumbersTableProps {
  phones: PhoneWithMetrics[];
  onViewDetails?: (phoneId: string) => void;
  onReactivate?: (phoneId: string) => void;
}

export function PhoneNumbersTable({ 
  phones, 
  onViewDetails,
  onReactivate,
}: PhoneNumbersTableProps) {
  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">🟢 Ativo</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">🟡 Pendente</Badge>;
      case 'inactive':
        return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">🔴 Parado</Badge>;
      default:
        return <Badge variant="outline">{status || 'Desconhecido'}</Badge>;
    }
  };

  const getQualityBadge = (quality: string | null) => {
    switch (quality?.toUpperCase()) {
      case 'GREEN':
        return <Badge className="bg-green-500/10 text-green-600">GREEN</Badge>;
      case 'YELLOW':
        return <Badge className="bg-yellow-500/10 text-yellow-600">YELLOW</Badge>;
      case 'RED':
        return <Badge className="bg-red-500/10 text-red-600">RED</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Format as +55 11 99999-9999
    if (phone.startsWith('+')) {
      return phone.replace(/(\+\d{2})(\d{2})(\d{5})(\d{4})/, '$1 $2 $3-$4');
    }
    return phone;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Msgs/s</TableHead>
            <TableHead className="text-right">Enviadas Hoje</TableHead>
            <TableHead className="text-right">Taxa Sucesso</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {phones.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Nenhum número de telefone encontrado
              </TableCell>
            </TableRow>
          ) : (
            phones.map((phone) => {
              const metrics = phone.todayMetrics;
              const totalSent = metrics?.messages_sent || 0;
              const totalFailed = metrics?.messages_failed || 0;
              const successRate = totalSent > 0 
                ? ((totalSent - totalFailed) / totalSent * 100).toFixed(1)
                : '-';
              const throughput = metrics?.max_throughput_achieved?.toFixed(1) || '0';
              const isInactive = phone.status === 'inactive';

              return (
                <TableRow key={phone.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{formatPhoneNumber(phone.phone_number)}</p>
                      {phone.display_name && (
                        <p className="text-xs text-muted-foreground">{phone.display_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(phone.status)}</TableCell>
                  <TableCell className={cn(
                    "text-right font-medium",
                    Number(throughput) > 30 && "text-green-600",
                    Number(throughput) > 10 && Number(throughput) <= 30 && "text-yellow-600",
                    Number(throughput) <= 10 && Number(throughput) > 0 && "text-red-600"
                  )}>
                    {throughput}
                  </TableCell>
                  <TableCell className="text-right">
                    {totalSent.toLocaleString()}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-medium",
                    successRate !== '-' && Number(successRate) >= 99 && "text-green-600",
                    successRate !== '-' && Number(successRate) >= 95 && Number(successRate) < 99 && "text-yellow-600",
                    successRate !== '-' && Number(successRate) < 95 && "text-red-600"
                  )}>
                    {successRate !== '-' ? `${successRate}%` : '-'}
                  </TableCell>
                  <TableCell>{getQualityBadge(phone.quality_rating)}</TableCell>
                  <TableCell className="text-right">
                    {isInactive ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onReactivate?.(phone.id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Reativar
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => onViewDetails?.(phone.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

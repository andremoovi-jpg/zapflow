import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ThroughputChartProps {
  data: Array<{
    timestamp: string;
    throughput: number;
    waiting?: number;
    active?: number;
  }>;
  maxThroughput?: number;
  title?: string;
  height?: number;
}

export function ThroughputChart({ 
  data, 
  maxThroughput = 80,
  title = 'Throughput em Tempo Real',
  height = 300,
}: ThroughputChartProps) {
  const chartData = data.map(point => ({
    ...point,
    time: new Date(point.timestamp).getTime(),
    formattedTime: format(new Date(point.timestamp), 'HH:mm:ss', { locale: ptBR }),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="formattedTime" 
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              domain={[0, maxThroughput + 10]}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="text-sm font-medium">{data.formattedTime}</p>
                      <p className="text-sm text-muted-foreground">
                        Throughput: <span className="font-medium text-foreground">{data.throughput.toFixed(1)}/s</span>
                      </p>
                      {data.waiting !== undefined && (
                        <p className="text-sm text-muted-foreground">
                          Aguardando: <span className="font-medium text-foreground">{data.waiting}</span>
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine 
              y={maxThroughput} 
              stroke="hsl(var(--destructive))" 
              strokeDasharray="5 5"
              label={{ value: 'Limite', position: 'right', fontSize: 10 }}
            />
            <Area
              type="monotone"
              dataKey="throughput"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#throughputGradient)"
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

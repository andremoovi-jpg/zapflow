import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface MessageStatusChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  loading?: boolean;
}

const COLORS = {
  'Lidas': 'hsl(142, 76%, 36%)',
  'Entregues': 'hsl(142, 76%, 50%)',
  'Enviadas': 'hsl(200, 80%, 50%)',
  'Pendentes': 'hsl(45, 93%, 47%)',
  'Falhas': 'hsl(0, 84%, 60%)',
};

export function MessageStatusChart({ data, loading }: MessageStatusChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Status das Mensagens</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[250px] animate-pulse rounded bg-muted" />
        ) : data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            Nenhuma mensagem encontrada
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[entry.name as keyof typeof COLORS] || 'hsl(var(--muted))'}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-sm">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

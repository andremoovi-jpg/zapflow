import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TopFlowsChartProps {
  data: Array<{
    id: string;
    name: string;
    executions: number;
  }>;
  loading?: boolean;
}

export function TopFlowsChart({ data, loading }: TopFlowsChartProps) {
  const truncateName = (name: string, maxLength = 20) => {
    return name.length > maxLength ? `${name.substring(0, maxLength)}...` : name;
  };

  const formattedData = data.map(item => ({
    ...item,
    shortName: truncateName(item.name),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Top 5 Fluxos</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[250px] animate-pulse rounded bg-muted" />
        ) : data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            Nenhum fluxo encontrado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={formattedData} 
              layout="vertical"
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis 
                type="category" 
                dataKey="shortName" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [value, 'Execuções']}
                labelFormatter={(label) => {
                  const item = formattedData.find(d => d.shortName === label);
                  return item?.name || label;
                }}
              />
              <Bar dataKey="executions" radius={[0, 4, 4, 0]}>
                {formattedData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`hsl(var(--primary) / ${1 - index * 0.15})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

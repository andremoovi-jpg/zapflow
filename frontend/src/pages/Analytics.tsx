import { useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useDashboardAnalytics, usePhonePerformance } from "@/hooks/useAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  MessageSquare,
  Send,
  CheckCheck,
  Eye,
  XCircle,
  Users,
  TrendingUp,
  Phone,
  Zap,
  MousePointerClick,
} from "lucide-react";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function Analytics() {
  const { currentOrganization } = useOrganization();
  const [days, setDays] = useState(7);

  const { data: analytics, isLoading } = useDashboardAnalytics(
    currentOrganization?.id,
    days
  );

  const { data: phonePerformance, isLoading: phonesLoading } = usePhonePerformance(
    currentOrganization?.id,
    days
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const messages = analytics?.messages || {
    total_sent: 0,
    total_received: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  };

  const deliveryRate = messages.total_sent > 0
    ? ((messages.delivered / messages.total_sent) * 100).toFixed(1)
    : "0";

  const readRate = messages.delivered > 0
    ? ((messages.read / messages.delivered) * 100).toFixed(1)
    : "0";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Metricas e performance do sistema
          </p>
        </div>
        <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Hoje</SelectItem>
            <SelectItem value="7">Ultimos 7 dias</SelectItem>
            <SelectItem value="30">Ultimos 30 dias</SelectItem>
            <SelectItem value="90">Ultimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messages.total_sent.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {messages.total_received.toLocaleString()} recebidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregues</CardTitle>
            <CheckCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messages.delivered.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {deliveryRate}% taxa de entrega
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lidas</CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messages.read.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {readRate}% taxa de leitura
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {messages.failed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {messages.total_sent > 0
                ? ((messages.failed / messages.total_sent) * 100).toFixed(1)
                : "0"}
              % taxa de falha
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliques</CardTitle>
            <MousePointerClick className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.link_clicks?.total_clicks?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics?.link_clicks?.unique_contacts?.toLocaleString() || 0} contatos unicos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="phones">Performance por Numero</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Grafico de Tendencia */}
            <Card>
              <CardHeader>
                <CardTitle>Mensagens por Dia</CardTitle>
                <CardDescription>
                  Enviadas vs Entregues vs Lidas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics?.daily_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })
                      }
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) =>
                        new Date(value).toLocaleDateString("pt-BR")
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="sent"
                      stroke="#3b82f6"
                      name="Enviadas"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="delivered"
                      stroke="#10b981"
                      name="Entregues"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="read"
                      stroke="#8b5cf6"
                      name="Lidas"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Resumo de Fluxos e Campanhas */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Campanhas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Campanhas</span>
                    </div>
                    <Badge variant="outline">
                      {analytics?.campaigns?.running || 0} ativas
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-bold">
                        {analytics?.campaigns?.total || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-bold">
                        {analytics?.campaigns?.total_messages?.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Msgs</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-bold">
                        {analytics?.campaigns?.completed || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Concluidas</div>
                    </div>
                  </div>
                </div>

                {/* Fluxos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Fluxos</span>
                    </div>
                    <Badge variant="outline">
                      {analytics?.flows?.total_active || 0} ativos
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-bold">
                        {analytics?.flows?.total_executions?.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Execucoes</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-bold">
                        {analytics?.flows?.completed_executions?.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Concluidas</div>
                    </div>
                  </div>
                </div>

                {/* Contatos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Contatos</span>
                    </div>
                    <Badge variant="outline">
                      +{analytics?.contacts?.new_this_period || 0} novos
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-bold">
                        {analytics?.contacts?.total?.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-bold">
                        {analytics?.contacts?.active_this_period?.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Ativos</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Campanhas */}
          {analytics?.top_campaigns && analytics.top_campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Campanhas</CardTitle>
                <CardDescription>Campanhas com mais mensagens no periodo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.top_campaigns.map((campaign, index) => (
                    <div key={campaign.id} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{campaign.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {campaign.total?.toLocaleString()} mensagens
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {campaign.read_rate || 0}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          taxa de leitura
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Phones Tab */}
        <TabsContent value="phones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance por Numero</CardTitle>
              <CardDescription>
                Metricas de cada numero de telefone nos ultimos {days} dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              {phonesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : phonePerformance && phonePerformance.length > 0 ? (
                <div className="space-y-4">
                  {phonePerformance.map((phone) => (
                    <div
                      key={phone.phone_number_id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {phone.display_name || phone.phone_number}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {phone.waba_name}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            phone.quality_rating === "GREEN"
                              ? "default"
                              : phone.quality_rating === "YELLOW"
                              ? "secondary"
                              : "destructive"
                          }
                          className={
                            phone.quality_rating === "GREEN"
                              ? "bg-green-500"
                              : phone.quality_rating === "YELLOW"
                              ? "bg-yellow-500"
                              : ""
                          }
                        >
                          {phone.quality_rating || "N/A"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Enviadas</div>
                          <div className="font-bold">
                            {phone.total_sent.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Entregues</div>
                          <div className="font-bold text-green-600">
                            {phone.total_delivered.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Lidas</div>
                          <div className="font-bold text-blue-600">
                            {phone.total_read.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Falhas</div>
                          <div className="font-bold text-red-600">
                            {phone.total_failed.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Taxa de Entrega</span>
                          <span className="font-medium">
                            {phone.delivery_rate || 0}%
                          </span>
                        </div>
                        <Progress
                          value={phone.delivery_rate || 0}
                          className="h-2"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Taxa de Leitura</span>
                          <span className="font-medium">
                            {phone.read_rate || 0}%
                          </span>
                        </div>
                        <Progress
                          value={phone.read_rate || 0}
                          className="h-2"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado de performance disponivel
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuicao de Status</CardTitle>
              <CardDescription>
                Status das mensagens de campanhas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Entregues", value: messages.delivered - messages.read },
                      { name: "Lidas", value: messages.read },
                      { name: "Falhas", value: messages.failed },
                      { name: "Pendentes", value: messages.total_sent - messages.delivered - messages.failed },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[0, 1, 2, 3].map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

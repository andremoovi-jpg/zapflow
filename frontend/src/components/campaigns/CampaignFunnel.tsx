import { useCampaignFunnel, FunnelAnalytics, FunnelStepStats } from '@/hooks/useCampaigns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MousePointerClick, MessageCircle, Image, Link, LayoutGrid,
  Clock, Tag, Globe, Users, TrendingDown, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const actionIcons: Record<string, React.ElementType> = {
  button_click: MousePointerClick,
  send_text: MessageCircle,
  send_image: Image,
  send_cta_url: Link,
  send_buttons: LayoutGrid,
  delay: Clock,
  add_tag: Tag,
  webhook: Globe,
};

const actionColors: Record<string, string> = {
  button_click: 'bg-purple-500',
  send_text: 'bg-green-500',
  send_image: 'bg-blue-500',
  send_cta_url: 'bg-indigo-500',
  send_buttons: 'bg-orange-500',
  delay: 'bg-yellow-500',
  add_tag: 'bg-pink-500',
  webhook: 'bg-cyan-500',
};

interface FunnelStepBarProps {
  step: FunnelStepStats;
  maxCount: number;
  isFirst: boolean;
}

function FunnelStepBar({ step, maxCount, isFirst }: FunnelStepBarProps) {
  const Icon = actionIcons[step.actionType] || MessageCircle;
  const colorClass = actionColors[step.actionType] || 'bg-gray-500';
  const widthPercent = maxCount > 0 ? (step.count / maxCount) * 100 : 0;

  return (
    <div className="relative">
      {!isFirst && (
        <div className="absolute left-6 -top-3 h-3 w-0.5 bg-muted-foreground/30" />
      )}
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-full text-white shrink-0', colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium truncate">{step.actionLabel}</span>
            <span className="text-sm text-muted-foreground ml-2">
              {step.count} ({step.percentage}%)
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', colorClass)}
              style={{ width: `${widthPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ButtonFunnelProps {
  data: FunnelAnalytics;
}

function ButtonFunnel({ data }: ButtonFunnelProps) {
  const [showContacts, setShowContacts] = useState(false);
  const maxCount = data.steps[0]?.count || 1;

  // Calcular drop-off entre etapas
  const dropOffs = data.steps.slice(1).map((step, idx) => {
    const prevCount = data.steps[idx].count;
    const dropOff = prevCount - step.count;
    const dropOffPercent = prevCount > 0 ? Math.round((dropOff / prevCount) * 100) : 0;
    return { dropOff, dropOffPercent };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-purple-500" />
            Botão: "{data.buttonText}"
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {data.totalClicks} cliques
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.steps.map((step, idx) => (
          <div key={step.stepIndex}>
            <FunnelStepBar
              step={step}
              maxCount={maxCount}
              isFirst={idx === 0}
            />
            {idx < dropOffs.length && dropOffs[idx].dropOff > 0 && (
              <div className="ml-12 mt-1 flex items-center gap-1 text-xs text-red-500">
                <TrendingDown className="h-3 w-3" />
                -{dropOffs[idx].dropOff} ({dropOffs[idx].dropOffPercent}% drop-off)
              </div>
            )}
          </div>
        ))}

        {/* Lista de contatos */}
        {data.contacts.length > 0 && (
          <div className="pt-2 border-t">
            <button
              onClick={() => setShowContacts(!showContacts)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', showContacts && 'rotate-180')} />
              Ver contatos ({new Set(data.contacts.map(c => c.contact_id)).size})
            </button>
            {showContacts && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {Array.from(new Set(data.contacts.map(c => c.contact_id))).map(contactId => {
                  const contact = data.contacts.find(c => c.contact_id === contactId)?.contact;
                  const lastStep = data.contacts
                    .filter(c => c.contact_id === contactId)
                    .sort((a, b) => b.step_index - a.step_index)[0];
                  return (
                    <div key={contactId} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                      <span>{contact?.name || contact?.phone_number || 'Desconhecido'}</span>
                      <span className="text-muted-foreground">
                        Etapa {lastStep.step_index}: {lastStep.action_label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CampaignFunnelProps {
  campaignId: string | undefined;
}

export function CampaignFunnel({ campaignId }: CampaignFunnelProps) {
  const { data: funnelData, isLoading } = useCampaignFunnel(campaignId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!funnelData || funnelData.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <MousePointerClick className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum dado de funil ainda.</p>
          <p className="text-sm mt-1">Os dados aparecerão quando os contatos clicarem nos botões da campanha.</p>
        </CardContent>
      </Card>
    );
  }

  // Estatísticas gerais
  const totalClicks = funnelData.reduce((sum, f) => sum + f.totalClicks, 0);
  const totalContacts = new Set(funnelData.flatMap(f => f.contacts.map(c => c.contact_id))).size;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalClicks}</div>
            <p className="text-xs text-muted-foreground">Cliques em botões</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalContacts}</div>
            <p className="text-xs text-muted-foreground">Contatos no funil</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{funnelData.length}</div>
            <p className="text-xs text-muted-foreground">Botões rastreados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {funnelData[0]?.steps.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Etapas no fluxo</p>
          </CardContent>
        </Card>
      </div>

      {/* Funis por botão */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Funil por Botão</h3>
        {funnelData.map(buttonFunnel => (
          <ButtonFunnel key={buttonFunnel.buttonText} data={buttonFunnel} />
        ))}
      </div>
    </div>
  );
}

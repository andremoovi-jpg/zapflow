import { ReactNode } from 'react';
import { LucideIcon, Users, GitBranch, MessageSquare, FileText, Key, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

// Preset empty states
export function EmptyContacts({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="Adicione seu primeiro contato"
      description="Comece importando contatos via CSV ou adicionando manualmente."
      action={{ label: 'Novo Contato', onClick: onAdd }}
    />
  );
}

export function EmptyFlows({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={GitBranch}
      title="Crie seu primeiro fluxo de automação"
      description="Automatize conversas criando fluxos visuais com gatilhos e ações."
      action={{ label: 'Criar Fluxo', onClick: onCreate }}
    />
  );
}

export function EmptyConversations() {
  return (
    <EmptyState
      icon={MessageSquare}
      title="As conversas aparecerão aqui"
      description="Quando seus contatos enviarem mensagens, as conversas serão listadas aqui."
    />
  );
}

export function EmptyTemplates({ onSync }: { onSync: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="Sincronize seus templates da Meta"
      description="Importe os templates de mensagem aprovados da sua conta do WhatsApp Business."
      action={{ label: 'Sincronizar Templates', onClick: onSync }}
    />
  );
}

export function EmptyApiKeys({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={Key}
      title="Nenhuma chave de API"
      description="Crie chaves de API para integrar com sistemas externos."
      action={{ label: 'Criar Chave', onClick: onCreate }}
    />
  );
}

export function EmptyTeamMembers({ onInvite }: { onInvite: () => void }) {
  return (
    <EmptyState
      icon={UserMinus}
      title="Convide membros para sua equipe"
      description="Adicione colegas para colaborar na gestão das conversas."
      action={{ label: 'Convidar Membro', onClick: onInvite }}
    />
  );
}

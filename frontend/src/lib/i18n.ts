type TranslationKey = string;

const translations: Record<string, Record<TranslationKey, string>> = {
  'pt-BR': {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.inbox': 'Inbox',
    'nav.contacts': 'Contatos',
    'nav.flows': 'Fluxos',
    'nav.campaigns': 'Campanhas',
    'nav.templates': 'Templates',
    'nav.settings': 'Configurações',

    // Common actions
    'action.add': 'Adicionar',
    'action.edit': 'Editar',
    'action.delete': 'Excluir',
    'action.save': 'Salvar',
    'action.cancel': 'Cancelar',
    'action.confirm': 'Confirmar',
    'action.search': 'Buscar',
    'action.filter': 'Filtrar',
    'action.export': 'Exportar',
    'action.import': 'Importar',
    'action.sync': 'Sincronizar',
    'action.refresh': 'Atualizar',
    'action.close': 'Fechar',
    'action.back': 'Voltar',
    'action.next': 'Próximo',
    'action.previous': 'Anterior',

    // Contacts
    'contacts.title': 'Contatos',
    'contacts.add': 'Novo Contato',
    'contacts.import': 'Importar CSV',
    'contacts.empty.title': 'Adicione seu primeiro contato',
    'contacts.empty.description': 'Comece importando contatos via CSV ou adicionando manualmente.',
    'contacts.delete.title': 'Excluir contato',
    'contacts.delete.description': 'Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.',

    // Flows
    'flows.title': 'Fluxos de Automação',
    'flows.add': 'Novo Fluxo',
    'flows.empty.title': 'Crie seu primeiro fluxo de automação',
    'flows.empty.description': 'Automatize conversas criando fluxos visuais com gatilhos e ações.',
    'flows.delete.title': 'Excluir fluxo',
    'flows.delete.description': 'Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita.',
    'flows.deactivate.title': 'Desativar fluxo',
    'flows.deactivate.description': 'O fluxo será pausado e não processará novas conversas.',

    // Campaigns
    'campaigns.title': 'Campanhas',
    'campaigns.add': 'Nova Campanha',
    'campaigns.cancel.title': 'Cancelar campanha',
    'campaigns.cancel.description': 'Tem certeza que deseja cancelar esta campanha? As mensagens pendentes não serão enviadas.',

    // Templates
    'templates.title': 'Templates',
    'templates.sync': 'Sincronizar Templates',
    'templates.empty.title': 'Sincronize seus templates da Meta',
    'templates.empty.description': 'Importe os templates de mensagem aprovados da sua conta do WhatsApp Business.',

    // Inbox
    'inbox.title': 'Inbox',
    'inbox.empty.title': 'As conversas aparecerão aqui',
    'inbox.empty.description': 'Quando seus contatos enviarem mensagens, as conversas serão listadas aqui.',

    // Settings
    'settings.title': 'Configurações',
    'settings.team.remove.title': 'Remover membro',
    'settings.team.remove.description': 'Tem certeza que deseja remover este membro da equipe?',
    'settings.apiKey.revoke.title': 'Revogar chave de API',
    'settings.apiKey.revoke.description': 'A chave será invalidada imediatamente e não poderá mais ser usada.',

    // Status
    'status.active': 'Ativo',
    'status.inactive': 'Inativo',
    'status.pending': 'Pendente',
    'status.approved': 'Aprovado',
    'status.rejected': 'Rejeitado',
    'status.draft': 'Rascunho',
    'status.running': 'Em andamento',
    'status.completed': 'Concluído',
    'status.failed': 'Falhou',
    'status.scheduled': 'Agendada',
    'status.paused': 'Pausado',

    // Messages
    'message.success': 'Operação realizada com sucesso',
    'message.error': 'Ocorreu um erro. Tente novamente.',
    'message.loading': 'Carregando...',
    'message.saving': 'Salvando...',
    'message.noResults': 'Nenhum resultado encontrado',
  },

  'en': {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.inbox': 'Inbox',
    'nav.contacts': 'Contacts',
    'nav.flows': 'Flows',
    'nav.campaigns': 'Campaigns',
    'nav.templates': 'Templates',
    'nav.settings': 'Settings',

    // Common actions
    'action.add': 'Add',
    'action.edit': 'Edit',
    'action.delete': 'Delete',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.confirm': 'Confirm',
    'action.search': 'Search',
    'action.filter': 'Filter',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.sync': 'Sync',
    'action.refresh': 'Refresh',
    'action.close': 'Close',
    'action.back': 'Back',
    'action.next': 'Next',
    'action.previous': 'Previous',

    // Contacts
    'contacts.title': 'Contacts',
    'contacts.add': 'New Contact',
    'contacts.import': 'Import CSV',
    'contacts.empty.title': 'Add your first contact',
    'contacts.empty.description': 'Start by importing contacts via CSV or adding them manually.',
    'contacts.delete.title': 'Delete contact',
    'contacts.delete.description': 'Are you sure you want to delete this contact? This action cannot be undone.',

    // Flows
    'flows.title': 'Automation Flows',
    'flows.add': 'New Flow',
    'flows.empty.title': 'Create your first automation flow',
    'flows.empty.description': 'Automate conversations by creating visual flows with triggers and actions.',
    'flows.delete.title': 'Delete flow',
    'flows.delete.description': 'Are you sure you want to delete this flow? This action cannot be undone.',
    'flows.deactivate.title': 'Deactivate flow',
    'flows.deactivate.description': 'The flow will be paused and will not process new conversations.',

    // Campaigns
    'campaigns.title': 'Campaigns',
    'campaigns.add': 'New Campaign',
    'campaigns.cancel.title': 'Cancel campaign',
    'campaigns.cancel.description': 'Are you sure you want to cancel this campaign? Pending messages will not be sent.',

    // Templates
    'templates.title': 'Templates',
    'templates.sync': 'Sync Templates',
    'templates.empty.title': 'Sync your templates from Meta',
    'templates.empty.description': 'Import approved message templates from your WhatsApp Business account.',

    // Inbox
    'inbox.title': 'Inbox',
    'inbox.empty.title': 'Conversations will appear here',
    'inbox.empty.description': 'When your contacts send messages, conversations will be listed here.',

    // Settings
    'settings.title': 'Settings',
    'settings.team.remove.title': 'Remove member',
    'settings.team.remove.description': 'Are you sure you want to remove this team member?',
    'settings.apiKey.revoke.title': 'Revoke API key',
    'settings.apiKey.revoke.description': 'The key will be invalidated immediately and can no longer be used.',

    // Status
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.pending': 'Pending',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.draft': 'Draft',
    'status.running': 'Running',
    'status.completed': 'Completed',
    'status.failed': 'Failed',
    'status.scheduled': 'Scheduled',
    'status.paused': 'Paused',

    // Messages
    'message.success': 'Operation completed successfully',
    'message.error': 'An error occurred. Please try again.',
    'message.loading': 'Loading...',
    'message.saving': 'Saving...',
    'message.noResults': 'No results found',
  },
};

// Default locale
let currentLocale = 'pt-BR';

export function setLocale(locale: string) {
  if (translations[locale]) {
    currentLocale = locale;
    localStorage.setItem('locale', locale);
  }
}

export function getLocale(): string {
  return localStorage.getItem('locale') || currentLocale;
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const locale = getLocale();
  let text = translations[locale]?.[key] || translations['pt-BR']?.[key] || key;

  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      text = text.replace(`{${param}}`, String(value));
    });
  }

  return text;
}

export function useTranslation() {
  return { t, setLocale, getLocale };
}

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PanelRightClose, PanelRightOpen, ArrowLeft, Phone } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatArea } from '@/components/inbox/ChatArea';
import { ContactSidebar } from '@/components/inbox/ContactSidebar';
import { SendTemplateModal } from '@/components/inbox/SendTemplateModal';
import { InboxErrorBoundary } from '@/components/ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useConversations,
  useMessages,
  useMarkAsRead,
  Conversation,
  ConversationFilter,
  useSendMessage,
} from '@/hooks/useConversations';
import { useAllPhoneNumbers } from '@/hooks/useWhatsAppAccounts';
import { toast } from 'sonner';

export default function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationIdParam = searchParams.get('conversation');
  const isMobile = useIsMobile();

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);

  // Buscar todos os números de todas as WABAs
  const { data: allPhoneNumbers = [] } = useAllPhoneNumbers();

  const { data: conversations = [], isLoading: conversationsLoading } = useConversations(filter, search, selectedPhoneId);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(selectedConversation?.id || null);
  const markAsRead = useMarkAsRead();
  const sendMessage = useSendMessage();

  // Select conversation from URL param or first in list
  useEffect(() => {
    if (conversationIdParam && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationIdParam);
      if (conv) {
        setSelectedConversation(conv);
        return;
      }
    }
    
    if (!selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
    }
  }, [conversationIdParam, conversations, selectedConversation]);

  // Mark as read when selecting a conversation
  useEffect(() => {
    if (selectedConversation && (selectedConversation.unread_count ?? 0) > 0) {
      markAsRead.mutate(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setSearchParams({ conversation: conversation.id });
    if (isMobile) {
      setMobileView('chat');
    }
  };

  const handleBackToList = () => {
    setMobileView('list');
    setSelectedConversation(null);
  };

  const handleSendTemplate = async (templateId: string, variables: Record<string, string>) => {
    if (!selectedConversation) return;

    try {
      await sendMessage.mutateAsync({
        conversationId: selectedConversation.id,
        contactId: selectedConversation.contact_id,
        content: {
          template_id: templateId,
          variables,
        },
        type: 'template',
      });
      toast.success('Template enviado com sucesso');
    } catch (error) {
      toast.error('Erro ao enviar template');
    }
  };

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Inbox' }]}>
      <InboxErrorBoundary>
        <div className="flex h-[calc(100vh-8rem)] bg-card rounded-xl border border-border overflow-hidden animate-fade-in">
          {/* Conversations List - Hidden on mobile when viewing chat */}
          <div className={`${isMobile && mobileView === 'chat' ? 'hidden' : 'flex'} ${isMobile ? 'w-full' : ''}`}>
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversation?.id || null}
              onSelect={handleSelectConversation}
              filter={filter}
              onFilterChange={setFilter}
              search={search}
              onSearchChange={setSearch}
              isLoading={conversationsLoading}
              phoneNumbers={allPhoneNumbers}
              selectedPhoneId={selectedPhoneId}
              onPhoneChange={setSelectedPhoneId}
            />
          </div>

          {/* Chat Area - Full width on mobile */}
          <div className={`flex-1 ${isMobile && mobileView === 'list' ? 'hidden' : 'flex flex-col'}`}>
            {isMobile && mobileView === 'chat' && (
              <div className="h-12 border-b flex items-center px-3">
                <Button variant="ghost" size="icon" onClick={handleBackToList} aria-label="Voltar">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <span className="ml-2 font-medium truncate">
                  {selectedConversation?.contact?.name || selectedConversation?.contact?.phone_number}
                </span>
              </div>
            )}
            <ChatArea
              conversation={selectedConversation}
              messages={messages}
              isLoading={messagesLoading}
              onOpenTemplateModal={() => setTemplateModalOpen(true)}
            />
          </div>

          {/* Contact Sidebar Toggle (for tablet/desktop) */}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 xl:hidden z-10"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Fechar painel' : 'Abrir painel'}
            >
              {sidebarOpen ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRightOpen className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* Contact Details Sidebar - Hidden on mobile */}
          {!isMobile && (
            <ContactSidebar
              conversation={selectedConversation}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
          )}

          {/* Send Template Modal */}
          <SendTemplateModal
            open={templateModalOpen}
            onOpenChange={setTemplateModalOpen}
            onSend={handleSendTemplate}
            conversationId={selectedConversation?.id || null}
          />
        </div>
      </InboxErrorBoundary>
    </DashboardLayout>
  );
}

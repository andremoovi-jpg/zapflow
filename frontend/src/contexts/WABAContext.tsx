import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useOrganization } from './OrganizationContext';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppAccount {
  id: string;
  organization_id: string;
  name: string;
  waba_id: string;
  business_manager_id: string | null;
  business_name: string | null;
  status: string;
  health_status: string;
  last_health_check_at: string | null;
  messages_sent_today: number;
  rate_limit_per_day: number;
  rate_limit_per_second: number;
  last_error_message: string | null;
  proxy_enabled: boolean;
  proxy_type: string | null;
  proxy_url: string | null;
  proxy_username: string | null;
  created_at: string;
}

interface WABAContextType {
  selectedWABA: WhatsAppAccount | null;
  setSelectedWABA: (waba: WhatsAppAccount | null) => void;
  availableWABAs: WhatsAppAccount[];
  loading: boolean;
  refetch: () => Promise<void>;
}

const WABAContext = createContext<WABAContextType | undefined>(undefined);

export function WABAProvider({ children }: { children: ReactNode }) {
  const { currentOrg } = useOrganization();
  const [availableWABAs, setAvailableWABAs] = useState<WhatsAppAccount[]>([]);
  const [selectedWABA, setSelectedWABA] = useState<WhatsAppAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWABAs = async () => {
    if (!currentOrg?.id) {
      setAvailableWABAs([]);
      setSelectedWABA(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const wabas = (data || []) as WhatsAppAccount[];
      setAvailableWABAs(wabas);

      // Restore selected WABA from localStorage or select first
      const savedWABAId = localStorage.getItem(`waba_${currentOrg.id}`);
      const savedWABA = wabas.find(w => w.id === savedWABAId);
      setSelectedWABA(savedWABA || wabas[0] || null);
    } catch (error) {
      console.error('Error fetching WABAs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWABAs();
  }, [currentOrg?.id]);

  const handleSetSelectedWABA = (waba: WhatsAppAccount | null) => {
    setSelectedWABA(waba);
    if (waba && currentOrg?.id) {
      localStorage.setItem(`waba_${currentOrg.id}`, waba.id);
    }
  };

  return (
    <WABAContext.Provider
      value={{
        selectedWABA,
        setSelectedWABA: handleSetSelectedWABA,
        availableWABAs,
        loading,
        refetch: fetchWABAs,
      }}
    >
      {children}
    </WABAContext.Provider>
  );
}

export function useWABA() {
  const context = useContext(WABAContext);
  if (context === undefined) {
    throw new Error('useWABA must be used within a WABAProvider');
  }
  return context;
}

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: Record<string, unknown>;
  role: string;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
  loading: boolean;
  createOrganization: (name: string, slug: string) => Promise<{ error: Error | null; org: Organization | null }>;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setLoading(false);
      return;
    }

    try {
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select(`
          role,
          organizations (
            id,
            name,
            slug,
            plan,
            settings
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const orgs: Organization[] = (memberships || [])
        .filter((m) => m.organizations)
        .map((m) => ({
          id: (m.organizations as any).id,
          name: (m.organizations as any).name,
          slug: (m.organizations as any).slug,
          plan: (m.organizations as any).plan,
          settings: (m.organizations as any).settings,
          role: m.role,
        }));

      setOrganizations(orgs);
      
      // Set current org from localStorage or first org
      const savedOrgId = localStorage.getItem('currentOrgId');
      const savedOrg = orgs.find(o => o.id === savedOrgId);
      setCurrentOrg(savedOrg || orgs[0] || null);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [user]);

  const handleSetCurrentOrg = (org: Organization) => {
    setCurrentOrg(org);
    localStorage.setItem('currentOrgId', org.id);
  };

  const createOrganization = async (name: string, slug: string) => {
    if (!user) return { error: new Error('Not authenticated'), org: null };

    try {
      // Generate ID on client to avoid needing to select the inserted row
      const orgId = crypto.randomUUID();

      // Create organization WITHOUT .select() to avoid RLS SELECT policy check
      const { error: orgError } = await supabase
        .from('organizations')
        .insert({ id: orgId, name, slug });

      if (orgError) throw orgError;

      // Add user as admin - this allows SELECT policy to work afterwards
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgId,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      // Refetch organizations to get the newly created one
      await fetchOrganizations();

      const newOrg = organizations.find(o => o.id === orgId) || {
        id: orgId,
        name,
        slug,
        plan: 'free',
        settings: {},
        role: 'admin',
      };

      return { error: null, org: newOrg };
    } catch (error) {
      const err = error as Error;
      // Map RLS errors to user-friendly messages
      if (err.message?.includes('row-level security')) {
        return { error: new Error('Sua sessão pode ter expirado. Faça login novamente.'), org: null };
      }
      return { error: err, org: null };
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        setCurrentOrg: handleSetCurrentOrg,
        loading,
        createOrganization,
        refetch: fetchOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

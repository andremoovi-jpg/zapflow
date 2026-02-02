import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CampaignWizard } from '@/components/campaigns/CampaignWizard';

export default function CampaignNew() {
  return (
    <DashboardLayout 
      breadcrumbs={[
        { label: 'Campanhas', href: '/campaigns' },
        { label: 'Nova Campanha' }
      ]}
    >
      <div className="animate-fade-in">
        <CampaignWizard />
      </div>
    </DashboardLayout>
  );
}

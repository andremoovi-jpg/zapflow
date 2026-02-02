import { Building2, Smartphone, Phone, Users, Key, Webhook, FileText, CreditCard, ListPlus, MessageSquare, Send } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useState } from 'react';
import { WhatsAppAccountsTab } from '@/components/settings/WhatsAppAccountsTab';
import { PhoneNumbersTab } from '@/components/settings/PhoneNumbersTab';
import { TeamTab } from '@/components/settings/TeamTab';
import { ApiKeysTab } from '@/components/settings/ApiKeysTab';
import { CustomFieldsTab } from '@/components/settings/CustomFieldsTab';
import { AutoReplyTab } from '@/components/settings/AutoReplyTab';
import { TelegramTab } from '@/components/settings/TelegramTab';

export default function Settings() {
  const { currentOrg } = useOrganization();
  const [orgName, setOrgName] = useState(currentOrg?.name || '');

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Configurações' }]}>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações da sua organização
          </p>
        </div>

        <Tabs defaultValue="organization" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" />
              Organização
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <Smartphone className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="phones" className="gap-2">
              <Phone className="h-4 w-4" />
              Números
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Equipe
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <Key className="h-4 w-4" />
              API
            </TabsTrigger>
            <TabsTrigger value="custom-fields" className="gap-2">
              <ListPlus className="h-4 w-4" />
              Campos
            </TabsTrigger>
            <TabsTrigger value="auto-reply" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Auto-Resposta
            </TabsTrigger>
            <TabsTrigger value="telegram" className="gap-2">
              <Send className="h-4 w-4" />
              Telegram
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Faturamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organization" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Organização</CardTitle>
                <CardDescription>
                  Configure as informações básicas da sua organização
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Nome da Organização</Label>
                    <Input
                      id="orgName"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input id="slug" value={currentOrg?.slug || ''} disabled className="bg-muted" />
                  </div>
                </div>
                <Button>Salvar Alterações</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppAccountsTab />
          </TabsContent>

          <TabsContent value="phones">
            <PhoneNumbersTab />
          </TabsContent>

          <TabsContent value="team">
            <TeamTab />
          </TabsContent>

          <TabsContent value="api">
            <ApiKeysTab />
          </TabsContent>

          <TabsContent value="custom-fields">
            <CustomFieldsTab />
          </TabsContent>

          <TabsContent value="auto-reply">
            <AutoReplyTab />
          </TabsContent>

          <TabsContent value="telegram">
            <TelegramTab />
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Plano Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div>
                    <p className="text-lg font-semibold">Plano Gratuito</p>
                    <p className="text-sm text-muted-foreground">
                      Até 1.000 mensagens/mês • 1 número
                    </p>
                  </div>
                  <Button>Fazer Upgrade</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

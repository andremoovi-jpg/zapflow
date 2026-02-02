import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, ChevronLeft, ChevronRight, Users, FileText, Calendar, Eye, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useTemplates, Template, getComponent } from '@/hooks/useTemplates';
import { useContacts, useAllTags } from '@/hooks/useContacts';
import { useCreateCampaign, useStartCampaign } from '@/hooks/useCampaigns';
import { useCustomFields } from '@/hooks/useCustomFields';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ButtonActionsConfig, ButtonActionsMap } from './ButtonActionsConfig';

const steps = [
  { id: 1, name: 'Informações', icon: FileText },
  { id: 2, name: 'Template', icon: FileText },
  { id: 3, name: 'Audiência', icon: Users },
  { id: 4, name: 'Agendamento', icon: Calendar },
  { id: 5, name: 'Revisão', icon: Eye },
];

interface PhoneNumber {
  id: string;
  phone_number: string;
  display_name: string | null;
  whatsapp_account_id: string;
}

export function CampaignWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const { currentOrg } = useOrganization();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [audienceType, setAudienceType] = useState<'all' | 'tags' | 'filter'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [confirmed, setConfirmed] = useState(false);
  const [buttonActions, setButtonActions] = useState<ButtonActionsMap>({});

  // Data
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [taggedContactsCount, setTaggedContactsCount] = useState<number>(0);

  // Obter wabaId do phone number selecionado para filtrar templates
  const selectedPhoneWabaId = phoneNumbers.find(p => p.id === phoneNumberId)?.whatsapp_account_id;
  const { data: templates = [] } = useTemplates({ status: 'APPROVED', wabaId: selectedPhoneWabaId });
  const { data: tagsData = [] } = useAllTags();
  const { data: contactsData } = useContacts({ status: 'opted_in' }, 0);
  const { fields: customFieldsData = [] } = useCustomFields();
  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();

  // Load phone numbers
  useEffect(() => {
    async function loadPhoneNumbers() {
      if (!currentOrg?.id) return;

      const { data: accounts } = await supabase
        .from('whatsapp_accounts')
        .select('id')
        .eq('organization_id', currentOrg.id);

      if (!accounts?.length) return;

      const { data } = await supabase
        .from('phone_numbers')
        .select('*')
        .in('whatsapp_account_id', accounts.map(a => a.id))
        .eq('status', 'active');

      setPhoneNumbers(data || []);
      if (data?.length) setPhoneNumberId(data[0].id);
    }
    loadPhoneNumbers();
  }, [currentOrg?.id]);

  // Limpar template selecionado quando phone number muda (templates são específicos por WABA)
  useEffect(() => {
    setSelectedTemplate(null);
    setTemplateVariables({});
    setButtonActions({});
  }, [selectedPhoneWabaId]);

  // Buscar contagem real de contatos quando tags são selecionadas
  useEffect(() => {
    async function fetchTaggedContactsCount() {
      if (audienceType !== 'tags' || selectedTags.length === 0) {
        setTaggedContactsCount(0);
        return;
      }

      const { count, error } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('opted_in', true)
        .overlaps('tags', selectedTags);

      if (!error) {
        setTaggedContactsCount(count || 0);
      }
    }

    fetchTaggedContactsCount();
  }, [audienceType, selectedTags]);

  // Calculate audience count
  const audienceCount = audienceType === 'all'
    ? contactsData?.count || 0
    : audienceType === 'tags' && selectedTags.length > 0
      ? taggedContactsCount
      : 0;

  const getBodyText = (template: Template) => {
    const body = getComponent(template.components, 'BODY');
    return body?.text || '';
  };

  const getTemplateButtons = (template: Template) => {
    const buttons = getComponent(template.components, 'BUTTONS');
    return buttons?.buttons || [];
  };

  const hasButtons = selectedTemplate ? getTemplateButtons(selectedTemplate).length > 0 : false;

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    return matches ? [...new Set(matches)] : [];
  };

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return name.trim().length > 0 && phoneNumberId;
      case 2:
        return selectedTemplate !== null;
      case 3:
        return audienceType === 'all' || (audienceType === 'tags' && selectedTags.length > 0);
      case 4:
        return scheduleType === 'now' || (scheduleType === 'scheduled' && scheduledDate);
      case 5:
        return confirmed;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) return;

    const selectedPhone = phoneNumbers.find(p => p.id === phoneNumberId);
    
    let scheduledAt: string | null = null;
    if (scheduleType === 'scheduled' && scheduledDate) {
      const [hours, minutes] = scheduledTime.split(':');
      const date = new Date(scheduledDate);
      date.setHours(parseInt(hours), parseInt(minutes));
      scheduledAt = date.toISOString();
    }

    // Filtrar ações válidas (remover 'none')
    const validButtonActions = Object.fromEntries(
      Object.entries(buttonActions).filter(([_, action]) => action.type !== 'none')
    );

    const newCampaign = await createCampaign.mutateAsync({
      name,
      description: description || undefined,
      template_id: selectedTemplate.id,
      phone_number_id: phoneNumberId,
      whatsapp_account_id: selectedPhone?.whatsapp_account_id,
      audience_type: audienceType,
      audience_filter: audienceType === 'tags' ? { tags: selectedTags } : undefined,
      audience_count: audienceCount,
      template_variables: Object.keys(templateVariables).length > 0 ? templateVariables : undefined,
      scheduled_at: scheduledAt,
      status: scheduleType === 'now' ? 'draft' : 'scheduled',
      button_actions: Object.keys(validButtonActions).length > 0 ? validButtonActions : undefined,
    });

    // Se "Enviar agora", iniciar a campanha automaticamente
    if (scheduleType === 'now' && newCampaign?.id) {
      await startCampaign.mutateAsync(newCampaign.id);
    }

    navigate('/campaigns');
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Steps indicator */}
      <nav className="mb-8">
        <ol className="flex items-center justify-between">
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-center">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                currentStep > step.id 
                  ? "bg-primary border-primary text-primary-foreground"
                  : currentStep === step.id
                    ? "border-primary text-primary"
                    : "border-muted text-muted-foreground"
              )}>
                {currentStep > step.id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span className={cn(
                "ml-2 text-sm font-medium hidden sm:block",
                currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.name}
              </span>
              {index < steps.length - 1 && (
                <div className={cn(
                  "w-12 h-0.5 mx-2",
                  currentStep > step.id ? "bg-primary" : "bg-muted"
                )} />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === 1 && 'Informações Básicas'}
            {currentStep === 2 && 'Selecionar Template'}
            {currentStep === 3 && 'Selecionar Audiência'}
            {currentStep === 4 && 'Agendamento'}
            {currentStep === 5 && 'Revisão Final'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Campanha *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Black Friday 2024"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição interna da campanha"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="phone">Número Remetente *</Label>
                <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um número" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((phone) => (
                      <SelectItem key={phone.id} value={phone.id}>
                        {phone.display_name || phone.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {phoneNumbers.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Nenhum número configurado. Configure nas configurações.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Template Selection */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid gap-3 max-h-64 overflow-y-auto">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template);
                      const vars = extractVariables(getBodyText(template));
                      const initialVars: Record<string, string> = {};
                      vars.forEach(v => initialVars[v] = '');
                      setTemplateVariables(initialVars);
                    }}
                    className={cn(
                      "p-4 border rounded-lg cursor-pointer transition-colors",
                      selectedTemplate?.id === template.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-sm text-muted-foreground">{template.language}</p>
                      </div>
                      {selectedTemplate?.id === template.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {getBodyText(template)}
                    </p>
                  </div>
                ))}
                {templates.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum template aprovado encontrado
                  </p>
                )}
              </div>

              {selectedTemplate && Object.keys(templateVariables).length > 0 && (
                <div className="border-t pt-4 space-y-4">
                  <p className="font-medium">Preencher Variáveis</p>
                  <p className="text-sm text-muted-foreground">
                    Selecione um campo do contato ou digite um valor fixo para cada variável.
                  </p>
                  {Object.keys(templateVariables).map((key) => (
                    <div key={key} className="space-y-2">
                      <Label>Variável {key}</Label>
                      <div className="flex gap-2">
                        <Select
                          value={templateVariables[key]?.startsWith('{{') ? templateVariables[key] : 'static'}
                          onValueChange={(value) => {
                            if (value === 'static') {
                              setTemplateVariables(prev => ({ ...prev, [key]: '' }));
                            } else {
                              setTemplateVariables(prev => ({ ...prev, [key]: value }));
                            }
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="static">Valor fixo</SelectItem>
                            <SelectItem value="{{nome}}">Nome do contato</SelectItem>
                            <SelectItem value="{{telefone}}">Telefone</SelectItem>
                            <SelectItem value="{{email}}">Email</SelectItem>
                            {customFieldsData.map((field) => (
                              <SelectItem key={field.name} value={`{{${field.name}}}`}>
                                {field.label || field.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(!templateVariables[key]?.startsWith('{{')) && (
                          <Input
                            value={templateVariables[key] || ''}
                            onChange={(e) => setTemplateVariables(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder="Digite o valor fixo"
                            className="flex-1"
                          />
                        )}
                        {templateVariables[key]?.startsWith('{{') && (
                          <div className="flex-1 flex items-center px-3 bg-primary/10 border border-primary/20 rounded-md text-sm">
                            <span className="text-primary font-medium">{templateVariables[key]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Configuração de ações por botão */}
              {selectedTemplate && hasButtons && (
                <div className="border-t pt-4">
                  <ButtonActionsConfig
                    buttons={getTemplateButtons(selectedTemplate)}
                    buttonActions={buttonActions}
                    onButtonActionsChange={setButtonActions}
                    customFields={customFieldsData}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Audience */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <RadioGroup value={audienceType} onValueChange={(v) => setAudienceType(v as any)}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="flex-1 cursor-pointer">
                    <span className="font-medium">Todos os contatos</span>
                    <span className="text-sm text-muted-foreground block">
                      Enviar para todos os contatos com opt-in ativo
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="tags" id="tags" />
                  <Label htmlFor="tags" className="flex-1 cursor-pointer">
                    <span className="font-medium">Por tags</span>
                    <span className="text-sm text-muted-foreground block">
                      Selecionar contatos por tags específicas
                    </span>
                  </Label>
                </div>
              </RadioGroup>

              {audienceType === 'tags' && (
                <div className="border-t pt-4">
                  <Label className="mb-2 block">Selecione as tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {tagsData.map((tag) => (
                      <Button
                        key={tag}
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedTags(prev => 
                            prev.includes(tag) 
                              ? prev.filter(t => t !== tag)
                              : [...prev, tag]
                          );
                        }}
                      >
                        {tag}
                      </Button>
                    ))}
                    {tagsData.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhuma tag encontrada</p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-lg font-semibold">
                  <Users className="inline-block h-5 w-5 mr-2" />
                  {audienceCount.toLocaleString()} contatos selecionados
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Scheduling */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <RadioGroup value={scheduleType} onValueChange={(v) => setScheduleType(v as any)}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="now" id="now" />
                  <Label htmlFor="now" className="flex-1 cursor-pointer">
                    <span className="font-medium">Enviar agora</span>
                    <span className="text-sm text-muted-foreground block">
                      Iniciar o envio imediatamente após a confirmação
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="scheduled" id="scheduled" />
                  <Label htmlFor="scheduled" className="flex-1 cursor-pointer">
                    <span className="font-medium">Agendar</span>
                    <span className="text-sm text-muted-foreground block">
                      Escolher data e hora para o envio
                    </span>
                  </Label>
                </div>
              </RadioGroup>

              {scheduleType === 'scheduled' && (
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div>
                    <Label>Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left">
                          <Calendar className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, 'PPP', { locale: ptBR }) : 'Selecionar data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Hora</Label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="grid gap-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{name}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Template</span>
                  <span className="font-medium">{selectedTemplate?.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Audiência</span>
                  <span className="font-medium">
                    {audienceCount.toLocaleString()} contatos
                    {audienceType === 'tags' && ` (tags: ${selectedTags.join(', ')})`}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Agendamento</span>
                  <span className="font-medium">
                    {scheduleType === 'now' 
                      ? 'Imediato' 
                      : scheduledDate 
                        ? `${format(scheduledDate, 'PPP', { locale: ptBR })} às ${scheduledTime}`
                        : '-'
                    }
                  </span>
                </div>
              </div>

              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="confirm"
                    checked={confirmed}
                    onCheckedChange={(checked) => setConfirmed(checked as boolean)}
                  />
                  <Label htmlFor="confirm" className="cursor-pointer leading-relaxed">
                    Confirmo que esta campanha segue as políticas do WhatsApp Business e que
                    todos os destinatários deram consentimento para receber mensagens.
                  </Label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={currentStep === 1 ? () => navigate('/campaigns') : handleBack}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {currentStep === 1 ? 'Cancelar' : 'Voltar'}
        </Button>

        {currentStep < 5 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Próximo
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canProceed() || createCampaign.isPending || startCampaign.isPending}
          >
            {createCampaign.isPending ? 'Criando...' : startCampaign.isPending ? 'Iniciando...' : scheduleType === 'now' ? 'Criar e Enviar' : 'Criar Campanha'}
          </Button>
        )}
      </div>
    </div>
  );
}

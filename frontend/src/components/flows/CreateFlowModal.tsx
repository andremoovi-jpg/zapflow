import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateFlow } from '@/hooks/useFlows';
import { useNavigate } from 'react-router-dom';
import { MousePointerClick, MessageSquare, Webhook, Mail } from 'lucide-react';

interface CreateFlowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const triggerTypes = [
  { value: 'button_click', label: 'Clique em Botão', icon: MousePointerClick },
  { value: 'keyword', label: 'Palavra-chave', icon: MessageSquare },
  { value: 'webhook', label: 'Webhook Externo', icon: Webhook },
  { value: 'message_received', label: 'Mensagem Recebida', icon: Mail },
];

export function CreateFlowModal({ open, onOpenChange }: CreateFlowModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const navigate = useNavigate();
  const createFlow = useCreateFlow();

  const handleCreate = async () => {
    if (!name || !triggerType) return;

    const flow = await createFlow.mutateAsync({
      name,
      description,
      trigger_type: triggerType,
    });

    onOpenChange(false);
    setName('');
    setDescription('');
    setTriggerType('');
    navigate(`/flows/${flow.id}/edit`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Fluxo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Fluxo</Label>
            <Input
              id="name"
              placeholder="Ex: Boas-vindas"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descreva o objetivo do fluxo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Gatilho</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o gatilho" />
              </SelectTrigger>
              <SelectContent>
                {triggerTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      <span>{type.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!name || !triggerType || createFlow.isPending}
          >
            {createFlow.isPending ? 'Criando...' : 'Criar Fluxo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

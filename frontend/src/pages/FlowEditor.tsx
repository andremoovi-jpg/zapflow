import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Node, Edge } from 'reactflow';
import { ArrowLeft, Save, Play, Rocket, AlertTriangle, Monitor, BarChart3 } from 'lucide-react';
import { useFlowNodeStats } from '@/hooks/useAnalytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FlowCanvas, FlowCanvasRef } from '@/components/flows/FlowCanvas';
import { FlowEditorErrorBoundary } from '@/components/ErrorBoundary';
import { useFlowEditorShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useFlow,
  useFlowNodes,
  useFlowEdges,
  useUpdateFlow,
  useSaveFlowCanvas,
  useToggleFlowActive,
  NodeConfig,
} from '@/hooks/useFlows';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { validateFlow, exportFlowToJSON } from '@/lib/flowUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

export default function FlowEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const canvasRef = useRef<FlowCanvasRef>(null);
  const isMobile = useIsMobile();

  const { data: flow, isLoading: flowLoading } = useFlow(id);
  const { data: dbNodes, isLoading: nodesLoading } = useFlowNodes(id);
  const { data: dbEdges, isLoading: edgesLoading } = useFlowEdges(id);

  const updateFlow = useUpdateFlow();
  const saveCanvas = useSaveFlowCanvas();
  const toggleActive = useToggleFlowActive();

  const [flowName, setFlowName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Fetch node stats when showStats is enabled
  const { data: nodeStats } = useFlowNodeStats(id, showStats);

  useEffect(() => {
    if (flow) {
      setFlowName(flow.name);
    }
  }, [flow]);

  const handleSave = useCallback(async () => {
    if (!id || !canvasRef.current) return;

    const { nodes, edges } = canvasRef.current.getFlowData();

    await saveCanvas.mutateAsync({
      flowId: id,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.type,
        name: n.data.label,
        config: n.data.config as NodeConfig,
        position_x: Math.round(n.position.x),
        position_y: Math.round(n.position.y),
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source_node_id: e.source,
        target_node_id: e.target,
        source_handle: e.sourceHandle,
        label: e.label as string | undefined,
      })),
    });
  }, [id, saveCanvas]);

  // Keyboard shortcuts (after handleSave is defined)
  useFlowEditorShortcuts({
    onSave: handleSave,
    onDelete: () => {
      // Delete selected nodes - would need to integrate with ReactFlow's selection state
    },
  });

  const handleValidateAndPublish = useCallback(async () => {
    if (!id || !canvasRef.current || !flow) return;

    const { nodes, edges } = canvasRef.current.getFlowData();
    const validation = validateFlow(nodes, edges);

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      setShowValidationModal(true);
      return;
    }

    // Save first
    await handleSave();

    // Export to JSON for debugging/future n8n integration
    const executableFlow = exportFlowToJSON(id, flow.name, nodes, edges);
    console.log('Executable flow:', executableFlow);

    // Activate the flow
    await toggleActive.mutateAsync({ flowId: id, isActive: true });
    
    toast({ title: 'Fluxo publicado com sucesso!' });
  }, [id, flow, handleSave, toggleActive, toast]);

  const handleNameChange = async () => {
    if (!id || !flowName.trim()) return;
    await updateFlow.mutateAsync({ id, name: flowName.trim() });
    setIsEditing(false);
  };

  const handleToggleActive = async () => {
    if (!id || !flow || !canvasRef.current) return;
    
    // Validate before activating
    if (!flow.is_active) {
      const { nodes, edges } = canvasRef.current.getFlowData();
      const validation = validateFlow(nodes, edges);

      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        setShowValidationModal(true);
        return;
      }
    }

    await toggleActive.mutateAsync({ flowId: id, isActive: !flow.is_active });
  };

  const isLoading = flowLoading || nodesLoading || edgesLoading;

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="h-14 border-b px-4 flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Fluxo não encontrado</p>
      </div>
    );
  }

  // Mobile warning
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="h-14 border-b px-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/flows')} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{flow.name}</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Monitor className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Melhor experiência em desktop</h2>
              <p className="text-muted-foreground mb-6">
                O editor de fluxos funciona melhor em telas maiores. Use um computador para a melhor experiência.
              </p>
              <Button variant="outline" onClick={() => navigate('/flows')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Fluxos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <FlowEditorErrorBoundary>
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="h-14 border-b px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/flows')} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>

          {isEditing ? (
            <Input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              onBlur={handleNameChange}
              onKeyDown={(e) => e.key === 'Enter' && handleNameChange()}
              className="w-64 h-8"
              autoFocus
            />
          ) : (
            <h1
              className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditing(true)}
            >
              {flow.name}
            </h1>
          )}

          <div className="flex items-center gap-2 pl-4 border-l">
            <Switch
              id="flow-active"
              checked={flow.is_active}
              onCheckedChange={handleToggleActive}
            />
            <Label htmlFor="flow-active" className="text-sm text-muted-foreground">
              {flow.is_active ? 'Ativo' : 'Inativo'}
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showStats ? "default" : "outline"}
            size="sm"
            onClick={() => setShowStats(!showStats)}
            title="Mostrar/ocultar analytics por etapa"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button variant="outline" size="sm">
            <Play className="h-4 w-4 mr-2" />
            Testar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={saveCanvas.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveCanvas.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button
            size="sm"
            onClick={handleValidateAndPublish}
            disabled={toggleActive.isPending}
          >
            <Rocket className="h-4 w-4 mr-2" />
            {toggleActive.isPending ? 'Publicando...' : 'Publicar'}
          </Button>
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <FlowCanvas
          initialNodes={dbNodes || []}
          initialEdges={dbEdges || []}
          canvasRef={canvasRef}
          nodeStats={nodeStats}
          showStats={showStats}
        />
      </div>

        {/* Validation Errors Modal */}
        <Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Erros de Validação
              </DialogTitle>
              <DialogDescription>
                Corrija os seguintes erros antes de publicar o fluxo:
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 mt-4">
              {validationErrors.map((error, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-destructive">•</span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    </FlowEditorErrorBoundary>
  );
}

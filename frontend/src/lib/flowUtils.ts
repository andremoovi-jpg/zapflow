import { Node, Edge } from 'reactflow';
import { NodeConfig } from '@/hooks/useFlows';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ExecutableFlow {
  id: string;
  name: string;
  trigger: {
    type: string;
    config: NodeConfig;
  };
  startNodeId: string | null;
  nodes: Array<{
    id: string;
    type: string;
    config: NodeConfig;
    next: string | null;
    nextOnTrue?: string | null;
    nextOnFalse?: string | null;
    nextByButton?: Record<string, string>; // For condition_button: { "btn_0": "nodeId", "btn_1": "nodeId" }
  }>;
}

export function validateFlow(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: string[] = [];

  // Must have exactly 1 trigger
  const triggers = nodes.filter((n) => n.data?.type?.startsWith('trigger_'));
  if (triggers.length === 0) {
    errors.push('O fluxo precisa de um gatilho');
  }
  if (triggers.length > 1) {
    errors.push('O fluxo pode ter apenas um gatilho');
  }

  // Trigger must have output connection
  const trigger = triggers[0];
  if (trigger) {
    const hasOutput = edges.some((e) => e.source === trigger.id);
    if (!hasOutput) {
      errors.push('O gatilho precisa estar conectado a uma ação');
    }
  }

  // All nodes (except trigger) must have input
  nodes.forEach((node) => {
    if (!node.data?.type?.startsWith('trigger_')) {
      const hasInput = edges.some((e) => e.target === node.id);
      if (!hasInput) {
        errors.push(`O nó "${node.data?.label || node.id}" não está conectado`);
      }
    }
  });

  // Conditions must have both outputs (except condition_button which has dynamic outputs)
  nodes
    .filter((n) => n.data?.type?.startsWith('condition_'))
    .forEach((node) => {
      const outputs = edges.filter((e) => e.source === node.id);
      const config = node.data?.config as NodeConfig | undefined;

      // condition_button uses dynamic outputs based on configured conditions
      if (node.data?.type === 'condition_button') {
        const conditions = config?.conditions || [];
        if (conditions.length === 0) {
          errors.push(`O nó "${node.data?.label || node.id}" precisa de pelo menos uma condição de botão configurada`);
        } else {
          // Check if all configured conditions have connections
          const missingConnections = conditions.filter(
            (cond: { buttonText: string; output: string }) => !outputs.some((e) => e.sourceHandle === cond.output)
          );
          if (missingConnections.length > 0) {
            errors.push(`O nó "${node.data?.label || node.id}" tem saídas não conectadas: ${missingConnections.map((c: { buttonText: string }) => c.buttonText || '?').join(', ')}`);
          }
        }
      } else {
        // Standard conditions use true/false outputs
        const hasTrue = outputs.some((e) => e.sourceHandle === 'true');
        const hasFalse = outputs.some((e) => e.sourceHandle === 'false');

        if (!hasTrue || !hasFalse) {
          errors.push(`A condição "${node.data?.label || node.id}" precisa de ambos os caminhos (sim/não)`);
        }
      }
    });

  // Validate required configs
  nodes.forEach((node) => {
    const config = node.data?.config as NodeConfig | undefined;
    const type = node.data?.type;
    const label = node.data?.label || node.id;

    if (type === 'action_send_text' && !config?.message) {
      errors.push(`O nó "${label}" precisa de uma mensagem`);
    }
    if (type === 'action_send_template' && !config?.templateId && !config?.templateName) {
      errors.push(`O nó "${label}" precisa de um template selecionado`);
    }
    if (type === 'action_send_buttons' && !config?.body) {
      errors.push(`O nó "${label}" precisa de um texto para a mensagem`);
    }
    if (type === 'action_delay' && (!config?.amount || !config?.unit)) {
      errors.push(`O nó "${label}" precisa de um tempo de espera configurado`);
    }
    if (type === 'trigger_keyword' && (!config?.keywords || config.keywords.length === 0)) {
      errors.push(`O gatilho "${label}" precisa de pelo menos uma palavra-chave`);
    }
    if (type === 'action_webhook' && !config?.url) {
      errors.push(`O nó "${label}" precisa de uma URL`);
    }
    if (type === 'condition_tag' && !config?.tag) {
      errors.push(`A condição "${label}" precisa de uma tag selecionada`);
    }
    if (type === 'condition_field' && !config?.field) {
      errors.push(`A condição "${label}" precisa de um campo selecionado`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function exportFlowToJSON(
  flowId: string,
  flowName: string,
  nodes: Node[],
  edges: Edge[]
): ExecutableFlow {
  const triggerNode = nodes.find((n) => n.data?.type?.startsWith('trigger_'));

  const executableNodes = nodes
    .filter((n) => !n.data?.type?.startsWith('trigger_'))
    .map((node) => {
      const outgoingEdges = edges.filter((e) => e.source === node.id);

      // Handle condition_button with dynamic outputs
      if (node.data?.type === 'condition_button') {
        const nextByButton: Record<string, string> = {};
        outgoingEdges.forEach((edge) => {
          if (edge.sourceHandle) {
            nextByButton[edge.sourceHandle] = edge.target;
          }
        });

        return {
          id: node.id,
          type: node.data.type,
          config: node.data.config as NodeConfig,
          next: null,
          nextByButton,
        };
      }

      // Handle standard conditions with true/false outputs
      if (node.data?.type?.startsWith('condition_')) {
        const trueEdge = outgoingEdges.find((e) => e.sourceHandle === 'true');
        const falseEdge = outgoingEdges.find((e) => e.sourceHandle === 'false');

        return {
          id: node.id,
          type: node.data.type,
          config: node.data.config as NodeConfig,
          next: null,
          nextOnTrue: trueEdge?.target || null,
          nextOnFalse: falseEdge?.target || null,
        };
      }

      return {
        id: node.id,
        type: node.data?.type,
        config: node.data?.config as NodeConfig,
        next: outgoingEdges[0]?.target || null,
      };
    });

  // Find first node after trigger
  const triggerEdge = edges.find((e) => e.source === triggerNode?.id);

  return {
    id: flowId,
    name: flowName,
    trigger: {
      type: triggerNode?.data?.type || '',
      config: (triggerNode?.data?.config as NodeConfig) || {},
    },
    startNodeId: triggerEdge?.target || null,
    nodes: executableNodes,
  };
}

export function getTriggerType(nodes: Node[]): string {
  const trigger = nodes.find((n) => n.data?.type?.startsWith('trigger_'));
  return trigger?.data?.type || 'trigger_message';
}

export function getTriggerConfig(nodes: Node[]): NodeConfig {
  const trigger = nodes.find((n) => n.data?.type?.startsWith('trigger_'));
  return (trigger?.data?.config as NodeConfig) || {};
}

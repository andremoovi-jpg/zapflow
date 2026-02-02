import { useCallback, useRef, useState, useImperativeHandle } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  ReactFlowProvider,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import FlowNodeComponent from './FlowNode';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import { NodeConfig, FlowNode, FlowEdge } from '@/hooks/useFlows';

const nodeTypes = {
  flowNode: FlowNodeComponent,
};

export interface FlowCanvasRef {
  getFlowData: () => { nodes: Node[]; edges: Edge[] };
}

interface NodeStats {
  [nodeId: string]: {
    entered: number;
    completed: number;
    failed: number;
    completion_rate: number;
    button_clicks?: { [buttonId: string]: number };
  };
}

interface FlowCanvasProps {
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  canvasRef?: React.RefObject<FlowCanvasRef>;
  nodeStats?: NodeStats | null;
  showStats?: boolean;
}

interface FlowCanvasInnerProps extends FlowCanvasProps {}

function FlowCanvasInner({ initialNodes, initialEdges, canvasRef, nodeStats, showStats }: FlowCanvasInnerProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Convert DB nodes to ReactFlow nodes (with optional stats)
  const rfNodes: Node[] = initialNodes.map((n) => ({
    id: n.id,
    type: 'flowNode',
    position: { x: n.position_x, y: n.position_y },
    data: {
      label: n.name || n.type,
      type: n.type,
      config: n.config,
      stats: nodeStats?.[n.id],
      showStats: showStats,
    },
  }));

  // Convert DB edges to ReactFlow edges
  const rfEdges: Edge[] = initialEdges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    sourceHandle: e.source_handle || undefined,
    label: e.label || undefined,
    animated: true,
    style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 },
  }));

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(rfEdges);

  // Expose methods via ref for parent to access
  useImperativeHandle(
    canvasRef,
    () => ({
      getFlowData: () => ({ nodes, edges }),
    }),
    [nodes, edges]
  );

  // Sync changes back
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeInternal>[0]) => {
      onNodesChangeInternal(changes);
    },
    [onNodesChangeInternal]
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeInternal>[0]) => {
      onEdgesChangeInternal(changes);
    },
    [onEdgesChangeInternal]
  );

  // Connection handler
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: crypto.randomUUID(),
        animated: true,
        style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Drag and drop handlers
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow/type');
      const label = event.dataTransfer.getData('application/reactflow/label');

      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: crypto.randomUUID(),
        type: 'flowNode',
        position,
        data: { label, type, config: {} },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Node config update
  const handleNodeConfigUpdate = useCallback(
    (nodeId: string, config: Partial<NodeConfig>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, config },
            };
          }
          return node;
        })
      );
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, config } } : prev
      );
    },
    [setNodes]
  );

  // Delete node
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  // Keyboard delete
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode) {
        handleDeleteNode(selectedNode.id);
      }
    },
    [selectedNode, handleDeleteNode]
  );

  return (
    <div className="flex h-full" onKeyDown={onKeyDown} tabIndex={0}>
      <NodePalette onDragStart={onDragStart} />

      <div ref={reactFlowWrapper} className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 },
          }}
        >
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              const type = node.data?.type || '';
              if (type.startsWith('trigger_')) return 'hsl(270, 70%, 70%)';
              if (type.startsWith('condition_')) return 'hsl(45, 70%, 70%)';
              if (type.startsWith('action_send')) return 'hsl(120, 70%, 70%)';
              if (type.startsWith('action_')) return 'hsl(210, 70%, 70%)';
              return 'hsl(0, 0%, 70%)';
            }}
          />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>

      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdate={handleNodeConfigUpdate}
          onDelete={handleDeleteNode}
        />
      )}
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

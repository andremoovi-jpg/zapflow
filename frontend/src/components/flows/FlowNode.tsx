import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  MousePointerClick, MessageSquare, Webhook, Mail,
  Tag, FileText, Clock, Calendar,
  MessageCircle, LayoutGrid, List, Image,
  Plus, Minus, Edit, Globe,
  MessageSquareMore, Timer, UserRound, CircleStop,
  FileCode, ExternalLink, UserPlus, GitBranch
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNodeCategory, NodeConfig } from '@/hooks/useFlows';

const iconMap: Record<string, React.ElementType> = {
  trigger_button_click: MousePointerClick,
  trigger_keyword: MessageSquare,
  trigger_webhook: Webhook,
  trigger_message: Mail,
  trigger_contact_created: UserPlus,
  condition_button: GitBranch,
  condition_tag: Tag,
  condition_field: FileText,
  condition_time: Clock,
  condition_day: Calendar,
  action_send_text: MessageCircle,
  action_send_template: FileCode,
  action_send_buttons: LayoutGrid,
  action_send_list: List,
  action_send_media: Image,
  action_send_cta_url: ExternalLink,
  action_add_tag: Plus,
  action_remove_tag: Minus,
  action_update_field: Edit,
  action_webhook: Globe,
  action_wait_reply: MessageSquareMore,
  action_delay: Timer,
  action_transfer_human: UserRound,
  action_end: CircleStop,
};

const categoryStyles = {
  trigger: 'bg-purple-50 border-purple-400 dark:bg-purple-950/50 dark:border-purple-600',
  condition: 'bg-yellow-50 border-yellow-400 dark:bg-yellow-950/50 dark:border-yellow-600',
  action_message: 'bg-green-50 border-green-400 dark:bg-green-950/50 dark:border-green-600',
  action_data: 'bg-blue-50 border-blue-400 dark:bg-blue-950/50 dark:border-blue-600',
  control: 'bg-gray-50 border-gray-400 dark:bg-gray-800/50 dark:border-gray-600',
};

const categoryIconColors = {
  trigger: 'text-purple-600 dark:text-purple-400',
  condition: 'text-yellow-600 dark:text-yellow-400',
  action_message: 'text-green-600 dark:text-green-400',
  action_data: 'text-blue-600 dark:text-blue-400',
  control: 'text-gray-600 dark:text-gray-400',
};

interface NodeStats {
  entered: number;
  completed: number;
  failed: number;
  completion_rate: number;
  button_clicks?: { [buttonId: string]: number };
}

interface FlowNodeData {
  label: string;
  type: string;
  config: NodeConfig;
  stats?: NodeStats;
  showStats?: boolean;
}

function FlowNodeComponent({ data, selected }: NodeProps<FlowNodeData>) {
  const category = getNodeCategory(data.type);
  const Icon = iconMap[data.type] || MessageCircle;
  const isCondition = data.type.startsWith('condition_');
  const isTrigger = data.type.startsWith('trigger_');
  const stats = data.stats;
  const showStats = data.showStats && stats;

  // Check if template with buttons
  const isTemplateWithButtons = data.type === 'action_send_template' &&
    data.config?.waitForButtonResponse &&
    data.config?.templateButtons?.length > 0;
  const templateButtons = data.config?.templateButtons || [];

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 shadow-sm min-w-[180px] transition-all relative',
        categoryStyles[category],
        selected && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      {/* Stats Badge */}
      {showStats && (
        <div className="absolute -top-2 -right-2 flex gap-1">
          <div
            className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-500 text-white shadow"
            title={`${stats.entered} entraram neste passo`}
          >
            {stats.entered > 999 ? `${(stats.entered/1000).toFixed(1)}k` : stats.entered}
          </div>
          {stats.completion_rate < 100 && stats.entered > 0 && (
            <div
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-bold rounded shadow",
                stats.completion_rate >= 80 ? "bg-green-500 text-white" :
                stats.completion_rate >= 50 ? "bg-yellow-500 text-white" :
                "bg-red-500 text-white"
              )}
              title={`${stats.completion_rate}% completaram`}
            >
              {stats.completion_rate}%
            </div>
          )}
        </div>
      )}

      {/* Input handle (not for triggers) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={true}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}

      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-md bg-background/50', categoryIconColors[category])}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{data.label}</p>
          {data.config?.message && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {data.config.message.slice(0, 30)}...
            </p>
          )}
        </div>
      </div>

      {/* Button clicks stats */}
      {showStats && stats.button_clicks && Object.keys(stats.button_clicks).length > 0 && (
        <div className="mt-2 pt-2 border-t border-dashed flex flex-wrap gap-1">
          {Object.entries(stats.button_clicks).map(([btnId, clicks]) => (
            <span
              key={btnId}
              className="px-1.5 py-0.5 text-[9px] bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded"
              title={`${clicks} cliques no botao ${btnId}`}
            >
              {btnId}: {clicks}
            </span>
          ))}
        </div>
      )}

      {/* Output handles */}
      {data.type === 'condition_button' ? (
        data.config?.conditions?.length > 0 ? (
          <div className="relative mt-2">
            {/* Labels row */}
            <div className="flex justify-around text-[10px] text-muted-foreground px-1 mb-1">
              {data.config.conditions.map((cond: { buttonText: string; output: string }) => (
                <span key={`label-${cond.output}`} className="truncate max-w-[60px] text-center">
                  {cond.buttonText || '?'}
                </span>
              ))}
            </div>
            {/* Handles container - positioned at bottom of node */}
            {data.config.conditions.map((cond: { buttonText: string; output: string }, idx: number) => {
              const totalConditions = data.config.conditions!.length;
              const position = (idx + 1) / (totalConditions + 1) * 100;
              return (
                <Handle
                  key={cond.output}
                  type="source"
                  position={Position.Bottom}
                  id={cond.output}
                  isConnectable={true}
                  style={{
                    width: '14px',
                    height: '14px',
                    left: `${position}%`,
                    bottom: '-7px',
                    backgroundColor: `hsl(${(idx * 60) + 120}, 70%, 50%)`,
                    border: '2px solid white',
                    cursor: 'crosshair',
                    transform: 'translateX(-50%)',
                  }}
                />
              );
            })}
          </div>
        ) : (
          <>
            <Handle
              type="source"
              position={Position.Bottom}
              isConnectable={true}
              className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
            />
            <div className="mt-2 text-[10px] text-muted-foreground text-center">
              Configure as condições
            </div>
          </>
        )
      ) : isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            isConnectable={true}
            className="!w-4 !h-4 !bg-green-500 !border-2 !border-background !left-[30%] !cursor-crosshair"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            isConnectable={true}
            className="!w-4 !h-4 !bg-red-500 !border-2 !border-background !left-[70%] !cursor-crosshair"
          />
          <div className="flex justify-between mt-3 text-[10px] text-muted-foreground px-2">
            <span>Sim</span>
            <span>Não</span>
          </div>
        </>
      ) : isTemplateWithButtons ? (
        <div className="relative mt-2">
          {/* Labels row */}
          <div className="flex justify-around text-[10px] text-muted-foreground px-1 mb-1">
            {templateButtons.map((btn) => (
              <span key={`label-${btn.id}`} className="truncate max-w-[60px] text-center">{btn.text}</span>
            ))}
          </div>
          {/* Handles */}
          {templateButtons.map((btn, idx) => {
            const position = (idx + 1) / (templateButtons.length + 1) * 100;
            return (
              <Handle
                key={btn.id}
                type="source"
                position={Position.Bottom}
                id={btn.id}
                isConnectable={true}
                style={{
                  width: '14px',
                  height: '14px',
                  left: `${position}%`,
                  bottom: '-7px',
                  backgroundColor: `hsl(${(idx * 60) + 120}, 70%, 50%)`,
                  border: '2px solid white',
                  cursor: 'crosshair',
                  transform: 'translateX(-50%)',
                }}
              />
            );
          })}
        </div>
      ) : data.type !== 'action_end' ? (
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={true}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      ) : null}
    </div>
  );
}

// Custom comparison to ensure re-render when config.conditions changes
export default memo(FlowNodeComponent, (prevProps, nextProps) => {
  // Always re-render if selected state changes
  if (prevProps.selected !== nextProps.selected) return false;

  // Always re-render if type changes
  if (prevProps.data.type !== nextProps.data.type) return false;

  // Always re-render if label changes
  if (prevProps.data.label !== nextProps.data.label) return false;

  // Always re-render if stats changed
  if (prevProps.data.showStats !== nextProps.data.showStats) return false;
  if (JSON.stringify(prevProps.data.stats) !== JSON.stringify(nextProps.data.stats)) return false;

  // For condition_button, check if conditions changed
  if (nextProps.data.type === 'condition_button') {
    const prevConditions = prevProps.data.config?.conditions;
    const nextConditions = nextProps.data.config?.conditions;
    if (JSON.stringify(prevConditions) !== JSON.stringify(nextConditions)) return false;
  }

  // For templates with buttons, check if buttons changed
  if (nextProps.data.type === 'action_send_template') {
    const prevButtons = prevProps.data.config?.templateButtons;
    const nextButtons = nextProps.data.config?.templateButtons;
    if (JSON.stringify(prevButtons) !== JSON.stringify(nextButtons)) return false;
  }

  // Default: consider equal
  return true;
});

import {
  MousePointerClick, MessageSquare, Webhook, Mail,
  Tag, FileText, Clock, Calendar,
  MessageCircle, LayoutGrid, List, Image,
  Plus, Minus, Edit, Globe,
  MessageSquareMore, Timer, UserRound, CircleStop,
  FileCode, GitBranch
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { nodeCategories } from '@/hooks/useFlows';

const iconMap: Record<string, React.ElementType> = {
  MousePointerClick,
  MessageSquare,
  Webhook,
  Mail,
  Tag,
  FileText,
  Clock,
  Calendar,
  MessageCircle,
  FileTemplate: FileCode,
  LayoutGrid,
  List,
  Image,
  TagPlus: Plus,
  TagMinus: Minus,
  Edit,
  Globe,
  MessageSquareMore,
  Timer,
  UserRound,
  CircleStop,
  GitBranch,
};

const categoryLabels = {
  triggers: 'Gatilhos',
  conditions: 'Condições',
  actions: 'Ações',
};

const categoryColors = {
  triggers: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50',
  conditions: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
  actions: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-900/50',
};

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string, label: string) => void;
}

export function NodePalette({ onDragStart }: NodePaletteProps) {
  return (
    <div className="w-64 border-r bg-background h-full overflow-y-auto">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Componentes</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Arraste para o canvas
        </p>
      </div>

      <Accordion type="multiple" defaultValue={['triggers', 'conditions', 'actions']} className="px-2">
        {(Object.keys(nodeCategories) as Array<keyof typeof nodeCategories>).map((category) => (
          <AccordionItem key={category} value={category}>
            <AccordionTrigger className="text-sm py-3">
              {categoryLabels[category]}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pb-2">
                {nodeCategories[category].map((node) => {
                  const Icon = iconMap[node.icon] || MessageCircle;
                  return (
                    <div
                      key={node.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, node.type, node.label)}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-md border cursor-grab active:cursor-grabbing transition-colors',
                        categoryColors[category]
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-medium">{node.label}</span>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

import { Image, FileText, Video, Phone, ExternalLink, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Template, TemplateComponent, TemplateButton } from '@/hooks/useTemplates';
import { replaceVariables, getComponent } from '@/hooks/useTemplates';

interface TemplatePreviewProps {
  template: Template;
  variables?: Record<string, string>;
  className?: string;
}

function HeaderPreview({ component, variables }: { component: TemplateComponent; variables?: Record<string, string> }) {
  const format = component.format || 'TEXT';

  if (format === 'IMAGE') {
    return (
      <div className="bg-muted/50 rounded-t-lg h-32 flex items-center justify-center border-b border-border">
        <Image className="h-10 w-10 text-muted-foreground" />
      </div>
    );
  }

  if (format === 'VIDEO') {
    return (
      <div className="bg-muted/50 rounded-t-lg h-32 flex items-center justify-center border-b border-border">
        <Video className="h-10 w-10 text-muted-foreground" />
      </div>
    );
  }

  if (format === 'DOCUMENT') {
    return (
      <div className="bg-muted/50 rounded-t-lg h-20 flex items-center justify-center border-b border-border gap-2">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Documento</span>
      </div>
    );
  }

  // TEXT format
  if (component.text) {
    const text = variables ? replaceVariables(component.text, variables) : component.text;
    return (
      <div className="font-semibold text-sm p-3 border-b border-border">
        {text}
      </div>
    );
  }

  return null;
}

function BodyPreview({ component, variables }: { component: TemplateComponent; variables?: Record<string, string> }) {
  if (!component.text) return null;

  const text = variables ? replaceVariables(component.text, variables) : component.text;

  // Highlight variables
  const highlightedText = text.split(/(\{\{\d+\}\})/).map((part, index) => {
    if (/\{\{\d+\}\}/.test(part)) {
      return (
        <span key={index} className="bg-primary/20 text-primary px-1 rounded font-medium">
          {part}
        </span>
      );
    }
    return part;
  });

  return (
    <div className="p-3 text-sm whitespace-pre-wrap">
      {highlightedText}
    </div>
  );
}

function FooterPreview({ component }: { component: TemplateComponent }) {
  if (!component.text) return null;

  return (
    <div className="p-3 pt-0 text-xs text-muted-foreground">
      {component.text}
    </div>
  );
}

function ButtonPreview({ button }: { button: TemplateButton }) {
  const getIcon = () => {
    switch (button.type) {
      case 'URL':
        return <ExternalLink className="h-3.5 w-3.5" />;
      case 'PHONE_NUMBER':
        return <Phone className="h-3.5 w-3.5" />;
      case 'QUICK_REPLY':
        return <Reply className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  return (
    <button className="w-full py-2 text-sm text-primary font-medium border-t border-border flex items-center justify-center gap-1.5 hover:bg-muted/50 transition-colors">
      {getIcon()}
      {button.text}
    </button>
  );
}

function ButtonsPreview({ component }: { component: TemplateComponent }) {
  if (!component.buttons || component.buttons.length === 0) return null;

  return (
    <div className="divide-y divide-border">
      {component.buttons.map((button, index) => (
        <ButtonPreview key={index} button={button} />
      ))}
    </div>
  );
}

export function TemplatePreview({ template, variables, className }: TemplatePreviewProps) {
  const header = getComponent(template.components, 'HEADER');
  const body = getComponent(template.components, 'BODY');
  const footer = getComponent(template.components, 'FOOTER');
  const buttons = getComponent(template.components, 'BUTTONS');

  return (
    <div className={cn('bg-card border border-border rounded-lg overflow-hidden max-w-sm', className)}>
      {/* WhatsApp-style phone frame */}
      <div className="bg-[#075E54] text-white px-3 py-2 text-xs flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-[10px]">WA</span>
        </div>
        <span className="font-medium">{template.name}</span>
      </div>

      {/* Message bubble */}
      <div className="p-3 bg-[#DCF8C6] dark:bg-[#025C4C] m-2 rounded-lg shadow-sm">
        {header && <HeaderPreview component={header} variables={variables} />}
        {body && <BodyPreview component={body} variables={variables} />}
        {footer && <FooterPreview component={footer} />}
        {buttons && <ButtonsPreview component={buttons} />}
        
        {/* Timestamp */}
        <div className="text-right mt-1">
          <span className="text-[10px] text-muted-foreground">12:00</span>
        </div>
      </div>
    </div>
  );
}

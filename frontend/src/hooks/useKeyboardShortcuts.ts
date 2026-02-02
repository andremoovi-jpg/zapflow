import { useEffect, useCallback } from 'react';

type ShortcutHandler = () => void;

interface ShortcutOptions {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

interface Shortcut {
  key: string;
  handler: ShortcutHandler;
  options?: ShortcutOptions;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if typing in input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs
        if (event.key !== 'Escape') return;
      }

      for (const shortcut of shortcuts) {
        const { key, handler, options = {} } = shortcut;
        const ctrlOrMeta = options.ctrl || options.meta;

        const matchesKey = event.key.toLowerCase() === key.toLowerCase();
        const matchesCtrlMeta = ctrlOrMeta
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey;
        const matchesShift = options.shift ? event.shiftKey : !event.shiftKey;
        const matchesAlt = options.alt ? event.altKey : !event.altKey;

        if (matchesKey && matchesCtrlMeta && matchesShift && matchesAlt) {
          event.preventDefault();
          handler();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Pre-defined shortcuts for specific contexts
export function useInboxShortcuts({
  onQuickSearch,
  onSendMessage,
  onClosePanel,
}: {
  onQuickSearch?: () => void;
  onSendMessage?: () => void;
  onClosePanel?: () => void;
}) {
  useKeyboardShortcuts([
    ...(onQuickSearch
      ? [{ key: 'k', handler: onQuickSearch, options: { ctrl: true } }]
      : []),
    ...(onSendMessage
      ? [{ key: 'Enter', handler: onSendMessage, options: { ctrl: true } }]
      : []),
    ...(onClosePanel ? [{ key: 'Escape', handler: onClosePanel }] : []),
  ]);
}

export function useFlowEditorShortcuts({
  onSave,
  onUndo,
  onRedo,
  onDelete,
}: {
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
}) {
  useKeyboardShortcuts([
    ...(onSave ? [{ key: 's', handler: onSave, options: { ctrl: true } }] : []),
    ...(onUndo ? [{ key: 'z', handler: onUndo, options: { ctrl: true } }] : []),
    ...(onRedo ? [{ key: 'y', handler: onRedo, options: { ctrl: true } }] : []),
    ...(onDelete ? [{ key: 'Delete', handler: onDelete }] : []),
    ...(onDelete ? [{ key: 'Backspace', handler: onDelete }] : []),
  ]);
}

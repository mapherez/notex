import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { InlineStyleColor, InlineStyleKind } from '../../core/utils/inlineFormatting';
import type { MarkdownBlockStyle } from '../../core/utils/markdownFormatting';
import type { MarkdownTableAction } from '../../core/utils/markdownTables';

export type EditorToolbarMode = 'text' | 'preview';

export type EditorToolbarTarget = {
  id: string;
  kind: 'markdown' | 'plain';
  disabled?: boolean;
  canEditCurrentTable?: boolean;
  actions: {
    applyBlockStyle?: (style: MarkdownBlockStyle) => void;
    applyInlineStyle?: (kind: InlineStyleKind, color: InlineStyleColor | null) => void;
    applyTableAction?: (action: MarkdownTableAction) => void;
    insertCodeBlock?: () => void;
    insertLink?: () => void;
    replaceSelection?: (input: { fallback: string; prefix: string; suffix?: string }) => void;
  };
};

type EditorToolbarContextValue = {
  activeTarget: EditorToolbarTarget | null;
  activateTarget: (targetId: string) => void;
  mode: EditorToolbarMode;
  registerTarget: (target: EditorToolbarTarget) => void;
  setMode: (mode: EditorToolbarMode) => void;
  unregisterTarget: (targetId: string) => void;
};

const EditorToolbarContext = createContext<EditorToolbarContextValue | null>(null);

export function EditorToolbarProvider({
  children,
  mode,
  onModeChange,
}: {
  children: ReactNode;
  mode: EditorToolbarMode;
  onModeChange: (mode: EditorToolbarMode) => void;
}) {
  const [targets, setTargets] = useState<Record<string, EditorToolbarTarget>>({});
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);

  const registerTarget = useCallback((target: EditorToolbarTarget) => {
    setTargets((current) => (current[target.id] === target ? current : { ...current, [target.id]: target }));
  }, []);

  const unregisterTarget = useCallback((targetId: string) => {
    setTargets((current) => {
      if (!current[targetId]) {
        return current;
      }

      const next = { ...current };
      delete next[targetId];
      return next;
    });
    setActiveTargetId((current) => (current === targetId ? null : current));
  }, []);

  const activateTarget = useCallback((targetId: string) => {
    setActiveTargetId(targetId);
  }, []);

  const activeTarget = activeTargetId ? targets[activeTargetId] ?? null : null;

  const value = useMemo(
    () => ({
      activeTarget,
      activateTarget,
      mode,
      registerTarget,
      setMode: onModeChange,
      unregisterTarget,
    }),
    [activeTarget, activateTarget, mode, onModeChange, registerTarget, unregisterTarget],
  );

  return <EditorToolbarContext.Provider value={value}>{children}</EditorToolbarContext.Provider>;
}

export function useEditorToolbar() {
  const context = useContext(EditorToolbarContext);

  if (!context) {
    throw new Error('useEditorToolbar must be used within an EditorToolbarProvider');
  }

  return context;
}

export function useOptionalEditorToolbar() {
  return useContext(EditorToolbarContext);
}

export function useEditorToolbarTarget(target: EditorToolbarTarget) {
  const context = useContext(EditorToolbarContext);
  const registerTarget = context?.registerTarget;
  const unregisterTarget = context?.unregisterTarget;
  const activateTarget = context?.activateTarget;

  useEffect(() => {
    registerTarget?.(target);
  }, [registerTarget, target]);

  useEffect(() => {
    return () => unregisterTarget?.(target.id);
  }, [target.id, unregisterTarget]);

  return useMemo(
    () => ({
      activateTarget: () => activateTarget?.(target.id),
      mode: context?.mode,
      setMode: context?.setMode,
    }),
    [activateTarget, context?.mode, context?.setMode, target.id],
  );
}

"use client";

import { useCallback, useEffect, useRef } from "react";

import { RichTextViewer } from "@/components/ui/RichTextViewer";

export type LessonPassage = {
  id: string;
  text: string;
  startOffset: number;
  createdAt?: string;
};

type Props = {
  content: string;
  passages: LessonPassage[];
  onSavePassage: (payload: { text: string; startOffset: number }) => void;
  onRemovePassage?: (id: string) => void;
  saving?: boolean;
  className?: string;
};

/** Retorna o elemento .ProseMirror (conteúdo editável) ou null se ainda não existir. */
function getContentRoot(container: HTMLElement): HTMLElement | null {
  const proseMirror = container.querySelector(".ProseMirror");
  return proseMirror as HTMLElement | null;
}

/** Retorna o deslocamento em caracteres do início de root até (node, offsetInNode). */
function getOffsetInRoot(root: Node, targetNode: Node, offsetInNode: number): number {
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let current: Node | null = walker.nextNode();
  while (current) {
    if (current === targetNode) {
      return offset + offsetInNode;
    }
    offset += (current.textContent ?? "").length;
    current = walker.nextNode();
  }
  return offset;
}

/** Retorna o (node, offset) correspondente ao deslocamento em caracteres a partir do início de root. */
function getNodeAndOffsetAt(root: Node, charOffset: number): { node: Node; offset: number } | null {
  let passed = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let current: Node | null = walker.nextNode();
  while (current) {
    const len = (current.textContent ?? "").length;
    if (passed + len >= charOffset) {
      const offsetInNode = charOffset - passed;
      if (offsetInNode < 0 || offsetInNode > len) return null;
      return { node: current, offset: offsetInNode };
    }
    passed += len;
    current = walker.nextNode();
  }
  return null;
}

/** Cria um Range do início ao fim em caracteres dentro de root. */
function createRangeByOffsets(root: Node, startOffset: number, endOffset: number): Range | null {
  const start = getNodeAndOffsetAt(root, startOffset);
  const end = getNodeAndOffsetAt(root, endOffset);
  if (!start || !end) return null;
  try {
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  } catch {
    return null;
  }
}

/** Remove marcas aplicadas anteriormente (unwrap). */
function removePassageMarks(contentRoot: HTMLElement) {
  contentRoot.querySelectorAll("mark[data-passage-id]").forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
}

/** Aplica os trechos como <mark> no DOM, do último para o primeiro para não deslocar posições. */
function applyPassageMarks(contentRoot: HTMLElement, passages: LessonPassage[]) {
  // Limpa a seleção antes de mutar o DOM para evitar IndexSizeError ao colapsar seleção em nó alterado.
  const sel = window.getSelection();
  if (sel) sel.removeAllRanges();

  removePassageMarks(contentRoot);
  if (passages.length === 0) return;

  const sorted = [...passages].sort((a, b) => b.startOffset - a.startOffset);
  const totalLength = (contentRoot.textContent ?? "").length;

  for (const p of sorted) {
    const endOffset = p.startOffset + p.text.length;
    if (p.startOffset < 0 || endOffset > totalLength) continue;
    const range = createRangeByOffsets(contentRoot, p.startOffset, endOffset);
    if (!range) continue;
    try {
      const mark = document.createElement("mark");
      mark.className = "bg-yellow-200 dark:bg-yellow-800/60 rounded px-0.5";
      mark.setAttribute("data-passage-id", p.id);
      range.surroundContents(mark);
    } catch {
      // range pode cruzar limites de nós de forma que surroundContents não suporta; ignorar
    }
  }
}

export function HighlightableContentViewer({
  content,
  passages,
  onSavePassage,
  saving = false,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRootRef = useRef<HTMLElement | null>(null);

  const applyHighlights = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const root = getContentRoot(container);
    if (!root) return;
    contentRootRef.current = root;
    if (passages.length === 0) {
      removePassageMarks(root);
      return;
    }
    applyPassageMarks(root, passages);
  }, [passages]);

  useEffect(() => {
    const delays = [150, 500, 1200];
    const ids = delays.map((ms) => setTimeout(applyHighlights, ms));
    return () => ids.forEach((id) => clearTimeout(id));
  }, [applyHighlights, content]);

  const handleDestacar = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const container = containerRef.current;
    if (!container) return;
    const root = getContentRoot(container);
    if (!root) return;
    if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return;

    const text = selection.toString().trim();
    if (!text) return;

    const startOffset = getOffsetInRoot(root, selection.anchorNode!, selection.anchorOffset);
    const focusOffset = getOffsetInRoot(root, selection.focusNode!, selection.focusOffset);
    const minOffset = Math.min(startOffset, focusOffset);
    const maxOffset = Math.max(startOffset, focusOffset);
    const actualStart = minOffset;
    if (actualStart < 0 || text.length !== maxOffset - minOffset) return;

    onSavePassage({ text, startOffset: actualStart });
    selection.removeAllRanges();
  }, [onSavePassage]);

  useEffect(() => {
    const onRequestDestacar = () => handleDestacar();
    window.addEventListener("highlightable-content-destacar", onRequestDestacar);
    return () => window.removeEventListener("highlightable-content-destacar", onRequestDestacar);
  }, [handleDestacar]);

  return (
    <div ref={containerRef} className={className}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDestacar}
          disabled={saving}
          className="rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Destacar trecho selecionado"}
        </button>
        <span className="text-xs text-[var(--text-muted)]">
          Selecione um trecho do texto e clique no botão para salvar como marca-texto.
        </span>
      </div>
      <RichTextViewer content={content} />
    </div>
  );
}

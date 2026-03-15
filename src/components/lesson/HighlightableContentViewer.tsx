"use client";

import { Highlighter } from "lucide-react";
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
  /** Quando true, não exibe o botão "Destacar trecho selecionado" (ex.: se estiver na barra da página). */
  hideDestacarButton?: boolean;
  /** Chamado quando o usuário tenta destacar mais de uma linha (ex.: para exibir toast). */
  onWarning?: (message: string) => void;
};

/** Retorna o elemento .ProseMirror (conteúdo editável) ou null se ainda não existir. */
function getContentRoot(container: HTMLElement): HTMLElement | null {
  const proseMirror = container.querySelector(".ProseMirror");
  return proseMirror as HTMLElement | null;
}

/** Retorna o deslocamento em caracteres do início de root até (node, offsetInNode). Só use quando targetNode for nó de texto. */
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

function getFirstTextNode(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  for (let i = 0; i < node.childNodes.length; i++) {
    const t = getFirstTextNode(node.childNodes[i]);
    if (t) return t;
  }
  return null;
}

function getLastTextNode(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const t = getLastTextNode(node.childNodes[i]);
    if (t) return t;
  }
  return null;
}

/**
 * Normaliza uma posição (node, offset) para (textNode, offsetInTextNode).
 * Assim o offset pode ser calculado com getOffsetInRoot de forma confiável.
 */
function normalizeToTextPosition(root: Node, node: Node, offset: number): { textNode: Text; offsetInTextNode: number } | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const len = (node.textContent ?? "").length;
    const safeOffset = Math.max(0, Math.min(offset, len));
    return { textNode: node as Text, offsetInTextNode: safeOffset };
  }
  if (node.nodeType !== Node.ELEMENT_NODE || !root.contains(node)) return null;
  const el = node as Element;
  const children = el.childNodes;
  if (offset <= 0) {
    const first = getFirstTextNode(el);
    return first ? { textNode: first, offsetInTextNode: 0 } : null;
  }
  if (offset >= children.length) {
    const last = getLastTextNode(el);
    return last ? { textNode: last, offsetInTextNode: (last.textContent ?? "").length } : null;
  }
  const lastOfPrev = getLastTextNode(children[offset - 1]);
  return lastOfPrev ? { textNode: lastOfPrev, offsetInTextNode: (lastOfPrev.textContent ?? "").length } : null;
}

/**
 * Retorna o deslocamento em caracteres do início de root até a posição (node, offset).
 * Usa normalização para nós de texto, para funcionar com qualquer boundary do Range.
 */
function getCharacterOffsetInRoot(root: Node, node: Node, offset: number): number {
  const norm = normalizeToTextPosition(root, node, offset);
  if (!norm) return -1;
  return getOffsetInRoot(root, norm.textNode, norm.offsetInTextNode);
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

const HIGHLIGHT_MARK_CLASS = "bg-yellow-300 dark:bg-yellow-600/70 rounded px-0.5";

/** Envolve cada segmento de texto do range em um <mark> (para ranges que cruzam parágrafos). */
function wrapRangeInMarksBySegments(
  contentRoot: Node,
  range: Range,
  passageId: string
): void {
  const textNodes: { node: Text; start: number; end: number }[] = [];
  const walker = document.createTreeWalker(contentRoot, NodeFilter.SHOW_TEXT, null);
  let current: Node | null = walker.nextNode();
  let offset = 0;
  const rangeStart = getCharacterOffsetInRoot(contentRoot, range.startContainer, range.startOffset);
  const rangeEnd = getCharacterOffsetInRoot(contentRoot, range.endContainer, range.endOffset);
  if (rangeStart < 0 || rangeEnd < 0) return;

  while (current) {
    const textNode = current as Text;
    const len = (textNode.textContent ?? "").length;
    const nodeStart = offset;
    const nodeEnd = offset + len;
    offset = nodeEnd;
    if (nodeEnd <= rangeStart || nodeStart >= rangeEnd) {
      current = walker.nextNode();
      continue;
    }
    const segStart = Math.max(0, rangeStart - nodeStart);
    const segEnd = Math.min(len, rangeEnd - nodeStart);
    textNodes.push({ node: textNode, start: segStart, end: segEnd });
    current = walker.nextNode();
  }

  for (const { node, start, end } of textNodes) {
    try {
      const segRange = document.createRange();
      segRange.setStart(node, start);
      segRange.setEnd(node, end);
      const mark = document.createElement("mark");
      mark.className = HIGHLIGHT_MARK_CLASS;
      mark.setAttribute("data-passage-id", passageId);
      segRange.surroundContents(mark);
    } catch {
      // ignorar segmento que não puder ser envolvido
    }
  }
}

/** Aplica os trechos como <mark> no DOM, do último para o primeiro para não deslocar posições. */
function applyPassageMarks(contentRoot: HTMLElement, passages: LessonPassage[]) {
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
      mark.className = HIGHLIGHT_MARK_CLASS;
      mark.setAttribute("data-passage-id", p.id);
      range.surroundContents(mark);
    } catch {
      // range cruza blocos (vários parágrafos); aplicar por segmentos de texto
      wrapRangeInMarksBySegments(contentRoot, range, p.id);
    }
  }
}

export function HighlightableContentViewer({
  content,
  passages,
  onSavePassage,
  saving = false,
  className = "",
  hideDestacarButton = false,
  onWarning,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRootRef = useRef<HTMLElement | null>(null);
  /** Guarda o último range selecionado antes do clique no botão (o clique colapsa a seleção). */
  const savedRangeRef = useRef<Range | null>(null);

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
    console.log("[Destacar] Botão clicado / evento disparado.");
    const container = containerRef.current;
    if (!container) {
      console.log("[Destacar] Abortado: container não encontrado.");
      return;
    }
    const root = getContentRoot(container);
    if (!root) {
      console.log("[Destacar] Abortado: .ProseMirror (root) não encontrado.");
      return;
    }

    const selection = window.getSelection();
    let range: Range | null = null;
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      range = selection.getRangeAt(0);
      console.log("[Destacar] Usando range da seleção atual.");
    }
    if (!range && savedRangeRef.current) {
      range = savedRangeRef.current;
      console.log("[Destacar] Usando range salvo (savedRangeRef).");
    }
    savedRangeRef.current = null;

    if (!range || !root.contains(range.startContainer) || !root.contains(range.endContainer)) {
      console.log("[Destacar] Abortado: sem range válido ou seleção fora do conteúdo.", { range: !!range, startInRoot: range ? root.contains(range.startContainer) : false, endInRoot: range ? root.contains(range.endContainer) : false });
      return;
    }

    // Só permitir seleção dentro de um único bloco (uma linha/parágrafo)
    if (range.commonAncestorContainer === root) {
      console.log("[Destacar] Abortado: seleção em vários parágrafos.");
      onWarning?.("Selecione apenas um trecho em uma linha. Não é possível destacar texto em vários parágrafos.");
      return;
    }

    const startChar = getCharacterOffsetInRoot(root, range.startContainer, range.startOffset);
    const endChar = getCharacterOffsetInRoot(root, range.endContainer, range.endOffset);
    if (startChar < 0 || endChar < 0) {
      console.log("[Destacar] Abortado: offset inválido.", { startChar, endChar });
      return;
    }

    const actualStart = Math.min(startChar, endChar);
    const actualEnd = Math.max(startChar, endChar);
    let text = range.toString();
    const trimmed = text.trim();
    if (!trimmed) {
      console.log("[Destacar] Abortado: texto vazio após trim.");
      return;
    }

    const leadingSpace = text.length - text.trimStart().length;
    const trimStartOffset = actualStart + leadingSpace;

    console.log("[Destacar] Salvando trecho.", { text: trimmed, startOffset: trimStartOffset });
    onSavePassage({ text: trimmed, startOffset: trimStartOffset });
    if (selection) selection.removeAllRanges();
  }, [onSavePassage, onWarning]);

  /** Salva a seleção atual ao fazer mousedown no botão (antes do clique colapsar a seleção). */
  const handleDestacarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const container = containerRef.current;
        const root = container ? getContentRoot(container) : null;
        if (root && root.contains(sel.anchorNode) && root.contains(sel.focusNode)) {
          savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        }
      }
    },
    []
  );

  useEffect(() => {
    const onRequestDestacar = () => handleDestacar();
    window.addEventListener("highlightable-content-destacar", onRequestDestacar);
    return () => window.removeEventListener("highlightable-content-destacar", onRequestDestacar);
  }, [handleDestacar]);

  /** Mantém uma cópia da seleção atual quando está dentro do conteúdo (para não perder ao clicar no botão). */
  useEffect(() => {
    function onSelectionChange() {
      const container = containerRef.current;
      const root = container ? getContentRoot(container) : null;
      if (!root) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      if (root.contains(range.startContainer) && root.contains(range.endContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {!hideDestacarButton && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onMouseDown={handleDestacarMouseDown}
            onClick={handleDestacar}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] disabled:opacity-60"
          >
            <Highlighter className="h-4 w-4 shrink-0" aria-hidden />
            {saving ? "Salvando..." : "Destacar trecho selecionado"}
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            Selecione um trecho do texto e clique no botão para salvar como marca-texto.
          </span>
        </div>
      )}
      <RichTextViewer content={content} />
    </div>
  );
}

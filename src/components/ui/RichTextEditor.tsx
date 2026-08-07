"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "katex/dist/katex.min.css";

import {
  createRichTextExtensions,
  insertBlockMathFromPrompt,
  looksLikeLatex,
  normalizeLatexInput,
  parseRichTextContent,
  updateMathFromPrompt,
} from "@/lib/rich-text-extensions";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Digite o conteúdo...",
  className = "",
  minHeight = "120px",
}: RichTextEditorProps) {
  type BlockType = "paragraph" | "h1" | "h2" | "h3";
  const [blockType, setBlockType] = useState<BlockType>("paragraph");
  const editorRef = useRef<Editor | null>(null);

  const extensions = useMemo(
    () =>
      createRichTextExtensions({
        editable: true,
        onMathClick: (node, pos) => {
          const ed = editorRef.current;
          if (!ed) return;
          const latex = String(node.attrs.latex ?? "");
          const kind = ed.state.doc.nodeAt(pos)?.type.name === "blockMath" ? "block" : "inline";
          updateMathFromPrompt(ed, kind, pos, latex);
        },
      }),
    [],
  );

  const editor = useEditor({
    extensions,
    content: parseRichTextContent(value) || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] px-3 py-2 text-sm focus:outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-1 [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_table]:border [&_table]:border-[var(--card-border)] [&_td]:border [&_td]:border-[var(--card-border)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--card-border)] [&_th]:p-2 [&_th]:bg-[var(--igh-surface)] [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[var(--card-border)] [&_pre]:bg-[var(--igh-surface)] [&_pre]:p-4 [&_pre]:text-xs [&_code]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_.tiptap-mathematics-render]:mx-0.5 [&_.tiptap-mathematics-render]:cursor-pointer [&_.tiptap-mathematics-render]:rounded [&_.tiptap-mathematics-render]:px-0.5 [&_.tiptap-mathematics-render]:hover:bg-[var(--igh-surface)] [&_.tiptap-mathematics-render[data-type=block-math]]:my-3 [&_.tiptap-mathematics-render[data-type=block-math]]:block [&_.tiptap-mathematics-render[data-type=block-math]]:overflow-x-auto [&_.tiptap-mathematics-render[data-type=block-math]]:py-2 [&_.tiptap-mathematics-render[data-type=block-math]]:text-center",
        "data-placeholder": placeholder,
      },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
        if (!text || !looksLikeLatex(text)) return false;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length > 6) return false;
        const latex = normalizeLatexInput(text);
        if (!latex) return false;
        const ed = editorRef.current;
        if (!ed) return false;
        event.preventDefault();
        const isBlock =
          text.includes("$$$") ||
          /\\begin\{|\\frac|\\sum|\\int|\\lim|\\sqrt/.test(latex) ||
          lines.length > 1;
        if (isBlock) {
          ed.chain().focus().insertBlockMath({ latex }).run();
        } else {
          ed.chain().focus().insertInlineMath({ latex }).run();
        }
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (ed.isActive("heading", { level: 1 })) setBlockType("h1");
      else if (ed.isActive("heading", { level: 2 })) setBlockType("h2");
      else if (ed.isActive("heading", { level: 3 })) setBlockType("h3");
      else setBlockType("paragraph");
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sincronizar valor externo (ex.: ao abrir edição de outro curso)
  useEffect(() => {
    if (!editor) return;
    const content = parseRichTextContent(value);
    const alreadyEqual =
      typeof content === "string"
        ? (value || "") === editor.getHTML()
        : JSON.stringify(editor.getJSON()) === (value || "").trim();
    if (!alreadyEqual) {
      editor.commands.setContent(content || "", { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    if (editor.isActive("heading", { level: 1 })) setBlockType("h1");
    else if (editor.isActive("heading", { level: 2 })) setBlockType("h2");
    else if (editor.isActive("heading", { level: 3 })) setBlockType("h3");
    else setBlockType("paragraph");
  }, [editor]);

  const setBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const setItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const setBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const setOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
  const setCodeBlock = useCallback(() => editor?.chain().focus().toggleCodeBlock().run(), [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousHref = editor.getAttributes("link").href;
    const url = window.prompt("URL do link", previousHref || "https://");
    if (url == null) return;
    const href = url.trim();
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const withProtocol =
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith("/") || href.startsWith("#")
        ? href
        : `https://${href}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: withProtocol }).run();
  }, [editor]);

  const unsetLink = useCallback(() => editor?.chain().focus().unsetLink().run(), [editor]);

  const setImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL da imagem", "https://");
    if (url == null) return;
    const src = url.trim();
    if (src === "" || src === "https://") return;
    const withProtocol = /^[a-zA-Z]+:/.test(src) ? src : `https://${src}`;
    editor.chain().focus().setImage({ src: withProtocol }).run();
  }, [editor]);

  const insertTable = useCallback(
    (rows: number, cols: number) => {
      editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run();
    },
    [editor],
  );

  const insertMath = useCallback(() => {
    if (!editor) return;
    insertBlockMathFromPrompt(editor);
  }, [editor]);

  const setImageWidth = useCallback(
    (pct: string | null) => {
      if (!editor) return;
      editor.chain().focus().updateAttributes("image", { widthStyle: pct, width: null, height: null }).run();
    },
    [editor],
  );

  const onBlockTypeChange = useCallback(
    (next: BlockType) => {
      if (!editor) return;
      if (next === "paragraph") {
        editor.chain().focus().setParagraph().run();
      } else {
        const level = next === "h1" ? 1 : next === "h2" ? 2 : 3;
        editor.chain().focus().setHeading({ level }).run();
      }
    },
    [editor],
  );

  const blockTypeLabel = useMemo(
    () =>
      blockType === "paragraph"
        ? "Texto"
        : blockType === "h1"
          ? "Título 1"
          : blockType === "h2"
            ? "Título 2"
            : "Título 3",
    [blockType],
  );

  const imageWidth = editor?.getAttributes("image").widthStyle ?? editor?.getAttributes("image").width ?? null;
  const isImageSelected = editor?.isActive("image") ?? false;

  const toolbarClassName =
    "flex flex-wrap gap-1 border-b border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-1 shadow-sm sticky top-0 z-[100] rounded-t-md";

  if (!editor) {
    return (
      <div className={`rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] ${className}`} style={{ minHeight }}>
        <div className="animate-pulse p-3 text-[var(--text-muted)] text-sm">Carregando editor...</div>
      </div>
    );
  }

  return (
    <div className={`rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] ${className}`} style={{ minHeight }}>
      <div className={toolbarClassName}>
        <label className="sr-only" htmlFor="rte-blocktype">
          Tipo de texto
        </label>
        <select
          id="rte-blocktype"
          className="mr-2 h-8 rounded border border-[var(--card-border)] bg-[var(--input-bg)] px-2 text-sm text-[var(--input-text)]"
          value={blockType}
          onChange={(e) => onBlockTypeChange(e.target.value as BlockType)}
          title={`Tipo atual: ${blockTypeLabel}`}
        >
          <option value="paragraph">Parágrafo</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </select>
        <button
          type="button"
          onClick={() => insertTable(1, 2)}
          className="rounded px-2 py-1 text-sm hover:bg-zinc-200"
          title="Linha com 2 colunas (ex.: imagem + texto)"
        >
          Linha imagem+texto
        </button>
        <button
          type="button"
          onClick={() => insertTable(3, 3)}
          className="rounded px-2 py-1 text-sm hover:bg-zinc-200"
          title="Inserir tabela 3×3"
        >
          Tabela
        </button>
        <button type="button" onClick={setBold} className="rounded px-2 py-1 text-sm font-bold hover:bg-zinc-200" title="Negrito">
          B
        </button>
        <button type="button" onClick={setItalic} className="rounded px-2 py-1 text-sm italic hover:bg-zinc-200" title="Itálico">
          I
        </button>
        <button type="button" onClick={setBulletList} className="rounded px-2 py-1 text-sm hover:bg-zinc-200" title="Lista com marcadores">
          • Lista
        </button>
        <button type="button" onClick={setOrderedList} className="rounded px-2 py-1 text-sm hover:bg-zinc-200" title="Lista numerada">
          1. Lista
        </button>
        <button
          type="button"
          onClick={setCodeBlock}
          className="rounded px-2 py-1 text-sm font-mono hover:bg-zinc-200"
          title="Bloco de código (HTML, etc.)"
        >
          &lt;/&gt; Código
        </button>
        <button
          type="button"
          onClick={insertMath}
          className="rounded px-2 py-1 text-sm hover:bg-zinc-200"
          title="Inserir fórmula matemática (LaTeX). Ex.: \frac{1+2}{2-2}"
        >
          ∑ Fórmula
        </button>
        <button type="button" onClick={setLink} className="rounded px-2 py-1 text-sm text-blue-600 hover:bg-zinc-200" title="Inserir ou editar link">
          Link
        </button>
        <button type="button" onClick={setImage} className="rounded px-2 py-1 text-sm hover:bg-zinc-200" title="Inserir imagem (URL)">
          Imagem
        </button>
        {isImageSelected && (
          <span className="flex items-center gap-1">
            <label className="text-xs text-[var(--text-muted)]">Largura:</label>
            <select
              className="h-8 rounded border border-[var(--card-border)] bg-[var(--input-bg)] px-2 text-xs"
              value={imageWidth ?? "100%"}
              onChange={(e) => setImageWidth(e.target.value === "100%" ? null : e.target.value)}
              title="Tamanho da imagem"
            >
              <option value="25%">25%</option>
              <option value="50%">50%</option>
              <option value="75%">75%</option>
              <option value="100%">100%</option>
            </select>
          </span>
        )}
        {editor.isActive("link") && (
          <button type="button" onClick={unsetLink} className="rounded px-2 py-1 text-sm text-red-600 hover:bg-zinc-200" title="Remover link">
            Remover link
          </button>
        )}
      </div>
      <div className="lesson-rich-html overflow-hidden rounded-b-md">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

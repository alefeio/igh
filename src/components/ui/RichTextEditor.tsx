"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Conteúdo pode ser HTML (string) ou JSON TipTap/ProseMirror (string com type "doc"). */
function parseContent(value: string): string | Record<string, unknown> {
  const s = (value || "").trim();
  if (!s) return "";
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const parsed = JSON.parse(s) as { type?: string };
      if (parsed?.type === "doc") return parsed as Record<string, unknown>;
    } catch {
      // não é JSON válido, trata como HTML
    }
  }
  return s;
}

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
  const [blockType, setBlockType] = useState<"paragraph" | "title">("paragraph");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
    ],
    content: parseContent(value) || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] px-3 py-2 text-sm focus:outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const isTitle = editor.isActive("heading", { level: 1 }) || editor.isActive("heading", { level: 2 });
      setBlockType(isTitle ? "title" : "paragraph");
    },
  });

  // Sincronizar valor externo (ex.: ao abrir edição de outro curso)
  useEffect(() => {
    if (!editor) return;
    const content = parseContent(value);
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
    const isTitle = editor.isActive("heading", { level: 1 }) || editor.isActive("heading", { level: 2 });
    setBlockType(isTitle ? "title" : "paragraph");
  }, [editor]);

  const setBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const setItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const setBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const setOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);

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
    const withProtocol = /^[a-zA-Z]+:/.test(href) ? href : `https://${href}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: withProtocol }).run();
  }, [editor]);

  const unsetLink = useCallback(() => editor?.chain().focus().unsetLink().run(), [editor]);

  const onBlockTypeChange = useCallback(
    (next: "paragraph" | "title") => {
      if (!editor) return;
      if (next === "title") {
        editor.chain().focus().setHeading({ level: 2 }).run();
      } else {
        editor.chain().focus().setParagraph().run();
      }
    },
    [editor]
  );

  const blockTypeLabel = useMemo(() => (blockType === "title" ? "Título" : "Texto"), [blockType]);

  if (!editor) {
    return (
      <div className={`rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] ${className}`} style={{ minHeight }}>
        <div className="animate-pulse p-3 text-[var(--text-muted)] text-sm">Carregando editor...</div>
      </div>
    );
  }

  return (
    <div className={`rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] overflow-hidden ${className}`} style={{ minHeight }}>
      <div className="flex flex-wrap gap-1 border-b border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-1">
        <label className="sr-only" htmlFor="rte-blocktype">
          Tipo de texto
        </label>
        <select
          id="rte-blocktype"
          className="mr-2 h-8 rounded border border-[var(--card-border)] bg-[var(--input-bg)] px-2 text-sm text-[var(--input-text)]"
          value={blockType}
          onChange={(e) => onBlockTypeChange(e.target.value as "paragraph" | "title")}
          title={`Tipo atual: ${blockTypeLabel}`}
        >
          <option value="paragraph">Texto</option>
          <option value="title">Título</option>
        </select>
        <button
          type="button"
          onClick={setBold}
          className="rounded px-2 py-1 text-sm font-bold hover:bg-zinc-200"
          title="Negrito"
        >
          B
        </button>
        <button
          type="button"
          onClick={setItalic}
          className="rounded px-2 py-1 text-sm italic hover:bg-zinc-200"
          title="Itálico"
        >
          I
        </button>
        <button
          type="button"
          onClick={setBulletList}
          className="rounded px-2 py-1 text-sm hover:bg-zinc-200"
          title="Lista com marcadores"
        >
          • Lista
        </button>
        <button
          type="button"
          onClick={setOrderedList}
          className="rounded px-2 py-1 text-sm hover:bg-zinc-200"
          title="Lista numerada"
        >
          1. Lista
        </button>
        <button
          type="button"
          onClick={setLink}
          className="rounded px-2 py-1 text-sm text-blue-600 hover:bg-zinc-200"
          title="Inserir ou editar link"
        >
          Link
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            onClick={unsetLink}
            className="rounded px-2 py-1 text-sm text-red-600 hover:bg-zinc-200"
            title="Remover link"
          >
            Remover link
          </button>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

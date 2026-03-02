"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect } from "react";

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
  const editor = useEditor({
    extensions: [StarterKit],
    content: parseContent(value) || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "min-h-[120px] px-3 py-2 text-sm focus:outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
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

  const setBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const setItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const setBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const setOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);

  if (!editor) {
    return (
      <div className={`rounded-md border border-zinc-300 bg-white ${className}`} style={{ minHeight }}>
        <div className="animate-pulse p-3 text-zinc-400 text-sm">Carregando editor...</div>
      </div>
    );
  }

  return (
    <div className={`rounded-md border border-zinc-300 bg-white overflow-hidden ${className}`} style={{ minHeight }}>
      <div className="flex flex-wrap gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1">
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
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

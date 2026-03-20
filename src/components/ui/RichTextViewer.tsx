"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table/kit";
import { useEffect } from "react";

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

const ImageWithResize = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widthStyle: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-width-style") ?? null,
        renderHTML: (attrs) =>
          attrs.widthStyle ? { "data-width-style": attrs.widthStyle, style: `max-width: ${attrs.widthStyle}` } : {},
      },
    };
  },
}).configure({
  HTMLAttributes: { class: "max-w-full h-auto rounded-md" },
});

type RichTextViewerProps = {
  content: string;
  className?: string;
};

export function RichTextViewer({ content, className = "" }: RichTextViewerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      ImageWithResize,
      TableKit,
    ],
    content: parseContent(content) || "",
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "px-0 py-1 text-sm [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-1 [&_a]:text-[var(--igh-primary)] [&_a]:underline [&_a]:cursor-pointer [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_table]:border [&_table]:border-[var(--card-border)] [&_td]:border [&_td]:border-[var(--card-border)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--card-border)] [&_th]:p-2 [&_th]:bg-[var(--igh-surface)] [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[var(--card-border)] [&_pre]:bg-[var(--igh-surface)] [&_pre]:p-4 [&_pre]:text-xs [&_code]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(parseContent(content) || "", { emitUpdate: false });
  }, [content, editor]);

  if (!editor) {
    return (
      <div className={`animate-pulse rounded bg-[var(--igh-surface)] px-2 py-2 text-sm text-[var(--text-muted)] ${className}`}>
        Carregando...
      </div>
    );
  }

  return (
    <div
      className={`lesson-rich-html prose prose-sm max-w-none text-[var(--text-secondary)] ${className}`}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

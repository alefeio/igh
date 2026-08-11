"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useMemo } from "react";
import "katex/dist/katex.min.css";

import { createRichTextExtensions, parseRichTextContent } from "@/lib/rich-text-extensions";

type RichTextViewerProps = {
  content: string;
  className?: string;
};

function RichTextViewerInner({ content, className = "" }: RichTextViewerProps) {
  const extensions = useMemo(() => createRichTextExtensions({ editable: false }), []);
  const parsedContent = useMemo(() => parseRichTextContent(content) || "", [content]);

  const editor = useEditor({
    extensions,
    content: parsedContent,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "px-0 py-1 text-sm [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-1 [&_a]:text-[var(--igh-primary)] [&_a]:underline [&_a]:cursor-pointer [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_table]:border [&_table]:border-[var(--card-border)] [&_td]:border [&_td]:border-[var(--card-border)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--card-border)] [&_th]:p-2 [&_th]:bg-[var(--igh-surface)] [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[var(--card-border)] [&_pre]:bg-[var(--igh-surface)] [&_pre]:p-4 [&_pre]:text-xs [&_code]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_.tiptap-mathematics-render]:mx-0.5 [&_.tiptap-mathematics-render[data-type=block-math]]:my-3 [&_.tiptap-mathematics-render[data-type=block-math]]:block [&_.tiptap-mathematics-render[data-type=block-math]]:overflow-x-auto [&_.tiptap-mathematics-render[data-type=block-math]]:py-2 [&_.tiptap-mathematics-render[data-type=block-math]]:text-center",
      },
    },
  });

  if (!editor) {
    return (
      <div className={`animate-pulse rounded bg-[var(--igh-surface)] px-2 py-2 text-sm text-[var(--text-muted)] ${className}`}>
        Carregando...
      </div>
    );
  }

  return (
    <div className={`lesson-rich-html prose prose-sm max-w-none text-[var(--text-secondary)] ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
}

/** Remonta o editor quando o HTML muda — o setContent do TipTap reaproveita o <img> entre slides. */
export function RichTextViewer({ content, className = "" }: RichTextViewerProps) {
  return <RichTextViewerInner key={content} content={content} className={className} />;
}

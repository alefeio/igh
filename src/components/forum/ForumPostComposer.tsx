"use client";

import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { isForumPostEmpty } from "@/lib/forum-question-content";

import { ForumImageUpload } from "./ForumImageUpload";

type ForumPostComposerProps = {
  content: string;
  onContentChange: (value: string) => void;
  imageUrls: string[];
  onImageUrlsChange: (urls: string[]) => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
  placeholder?: string;
  minEditorHeight?: string;
  disabled?: boolean;
};

export function ForumPostComposer({
  content,
  onContentChange,
  imageUrls,
  onImageUrlsChange,
  onSubmit,
  submitting = false,
  submitLabel = "Publicar",
  placeholder = "Escreva sua mensagem (opcional)…",
  minEditorHeight = "140px",
  disabled = false,
}: ForumPostComposerProps) {
  const canSubmit = !disabled && !submitting && !isForumPostEmpty(content, imageUrls);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Mensagem (rich text, opcional)</p>
        <RichTextEditor
          value={content}
          onChange={onContentChange}
          placeholder={placeholder}
          minHeight={minEditorHeight}
        />
      </div>
      <ForumImageUpload
        imageUrls={imageUrls}
        onChange={onImageUrlsChange}
        disabled={disabled || submitting}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="self-start rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Enviando…" : submitLabel}
      </button>
    </div>
  );
}

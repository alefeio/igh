"use client";

import { RichTextViewer } from "@/components/ui/RichTextViewer";
import { contentLooksLikeHtml, stripRichTextToPlain } from "@/lib/forum-question-content";

import { ImageGallery } from "./ImageGallery";

type ForumPostBodyProps = {
  content: string;
  imageUrls?: string[];
  altPrefix?: string;
  className?: string;
};

export function ForumPostBody({ content, imageUrls = [], altPrefix, className = "" }: ForumPostBodyProps) {
  const hasImages = imageUrls.length > 0;
  const plain = stripRichTextToPlain(content);
  const hasText = plain.length > 0;

  if (!hasText && !hasImages) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {hasText &&
        (contentLooksLikeHtml(content) || content.trim().startsWith("{") ? (
          <RichTextViewer content={content} />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{plain}</p>
        ))}
      {hasImages && <ImageGallery images={imageUrls} altPrefix={altPrefix} />}
    </div>
  );
}

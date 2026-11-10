"use client";

import { FileText } from "lucide-react";

import { RichTextViewer } from "@/components/ui/RichTextViewer";
import {
  contentLooksLikeHtml,
  forumAttachmentFileName,
  isProbablyImageUrl,
  stripRichTextToPlain,
} from "@/lib/forum-question-content";

import { ImageGallery } from "./ImageGallery";

type ForumPostBodyProps = {
  content: string;
  imageUrls?: string[];
  altPrefix?: string;
  className?: string;
};

export function ForumPostBody({ content, imageUrls = [], altPrefix, className = "" }: ForumPostBodyProps) {
  const images = imageUrls.filter(isProbablyImageUrl);
  const files = imageUrls.filter((url) => !isProbablyImageUrl(url));
  const hasAttachments = images.length > 0 || files.length > 0;
  const plain = stripRichTextToPlain(content);
  const hasText = plain.length > 0;

  if (!hasText && !hasAttachments) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {hasText &&
        (contentLooksLikeHtml(content) || content.trim().startsWith("{") ? (
          <RichTextViewer content={content} />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{plain}</p>
        ))}
      {images.length > 0 && <ImageGallery images={images} altPrefix={altPrefix} />}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((url) => {
            const name = forumAttachmentFileName(url);
            return (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-2.5 py-1.5 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--card-bg)]"
                >
                  <FileText className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
                  <span className="min-w-0 truncate" title={name}>
                    {name}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

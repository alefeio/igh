"use client";

import { useEffect } from "react";

export function Modal({
  open,
  title,
  children,
  onClose,
  size = "default",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** "default" e "large" usam max-w-4xl (igual ao modal de edição da aula). "small" usa max-w-lg. */
  size?: "default" | "large" | "small";
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const maxWidthClass = size === "small" ? "max-w-lg" : "max-w-4xl";
  const contentMaxHeightClass = size === "small" ? "max-h-[calc(100vh-6rem)]" : "max-h-[calc(100vh-5rem)]";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-2 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={open ? "modal-title" : undefined}
    >
      <div className="flex min-h-full items-start justify-center py-4 sm:py-6" onClick={(e) => e.stopPropagation()}>
        <div className={`my-0 w-full ${maxWidthClass} flex-shrink-0 rounded-lg bg-[var(--card-bg)] shadow-lg border border-[var(--card-border)]`}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-3 sm:px-4">
            <div id="modal-title" className="min-w-0 flex-1 truncate text-sm font-semibold pr-2 text-[var(--text-primary)]">{title}</div>
            <button
              className="cursor-pointer shrink-0 rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] touch-manipulation"
              onClick={onClose}
              type="button"
              aria-label="Fechar"
            >
              Fechar
            </button>
          </div>
          <div className={`${contentMaxHeightClass} overflow-y-auto px-3 py-4 sm:px-4 text-[var(--text-primary)]`}>{children}</div>
        </div>
      </div>
    </div>
  );
}

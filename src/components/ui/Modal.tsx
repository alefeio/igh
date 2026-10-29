"use client";

import { useEffect, useRef } from "react";

export function Modal({
  open,
  title,
  children,
  onClose,
  size = "default",
  overlayClassName = "z-50",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** "default" e "large" usam max-w-4xl (igual ao modal de edição da aula). "small" usa max-w-lg. */
  size?: "default" | "large" | "small";
  /** Classe z-index do overlay (ex.: z-[110] quando o banner legal usa z-[100]). */
  overlayClassName?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onCloseRef.current(); }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [open]);

  if (!open) return null;

  const maxWidthClass = size === "small" ? "max-w-lg" : "max-w-4xl";
  const contentMaxHeightClass = size === "small" ? "max-h-[calc(100vh-6rem)]" : "max-h-[calc(100vh-5rem)]";

  return (
    <div
      ref={dialogRef}
      className={`fixed inset-0 overflow-y-auto bg-black/40 p-2 sm:p-4 ${overlayClassName}`}
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
              ref={closeRef}
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

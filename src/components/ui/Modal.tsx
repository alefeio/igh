"use client";

import { useEffect } from "react";

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-2 sm:p-4">
      <div className="flex min-h-full items-start justify-center py-4 sm:py-6">
        <div className="my-0 w-full max-w-lg flex-shrink-0 rounded-lg bg-white shadow-lg">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-3 sm:px-4">
            <div className="min-w-0 flex-1 truncate text-sm font-semibold pr-2">{title}</div>
            <button
              className="cursor-pointer shrink-0 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 touch-manipulation"
              onClick={onClose}
              type="button"
            >
              Fechar
            </button>
          </div>
          <div className="max-h-[calc(100vh-6rem)] overflow-y-auto px-3 py-4 sm:px-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

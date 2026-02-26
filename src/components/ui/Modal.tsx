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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
      <div className="flex min-h-full items-start justify-center py-6">
        <div className="my-0 w-full max-w-lg flex-shrink-0 rounded-lg bg-white shadow-lg">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
            <div className="text-sm font-semibold">{title}</div>
            <button
              className="cursor-pointer rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
              onClick={onClose}
              type="button"
            >
              Fechar
            </button>
          </div>
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

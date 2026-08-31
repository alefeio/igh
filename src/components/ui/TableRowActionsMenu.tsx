"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

type MenuPos = {
  top: number;
  right: number;
  openUp: boolean;
};

export function TableRowActionsMenu({
  open,
  onOpenChange,
  label,
  disabled,
  estimatedHeight = 280,
  menuClassName = "w-52",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  disabled?: boolean;
  /** Altura estimada do menu para decidir se abre para cima. */
  estimatedHeight?: number;
  menuClassName?: string;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function updatePosition() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    setPos({
      top: openUp ? rect.top : rect.bottom,
      right: Math.max(8, window.innerWidth - rect.right),
      openUp,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [open, estimatedHeight]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(ev: MouseEvent) {
      const target = ev.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onOpenChange(false);
    }

    function handleKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onOpenChange(false);
    }

    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, onOpenChange, estimatedHeight]);

  return (
    <div className="inline-flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        id={`${reactId}-trigger`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition hover:border-[var(--card-border)] hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-50"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${reactId}-menu` : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        <MoreVertical className="h-5 w-5" aria-hidden />
      </button>

      {mounted &&
        open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            id={`${reactId}-menu`}
            role="menu"
            aria-labelledby={`${reactId}-trigger`}
            className={`fixed z-50 overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] py-1 text-left shadow-lg ${menuClassName}`}
            style={
              pos.openUp
                ? {
                    bottom: window.innerHeight - pos.top + 4,
                    right: pos.right,
                  }
                : {
                    top: pos.top + 4,
                    right: pos.right,
                  }
            }
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}

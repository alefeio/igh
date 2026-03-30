"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Envia ao servidor o pathname atual (área autenticada) para o Master ver páginas acessadas.
 * Evita repetir a mesma rota em sequência (ex.: Strict Mode / re-renders).
 */
export function PageVisitTracker() {
  const pathname = usePathname();
  const lastSentRef = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/")) return;

    const now = Date.now();
    const prev = lastSentRef.current;
    if (prev && prev.path === pathname && now - prev.at < 8000) {
      return;
    }
    lastSentRef.current = { path: pathname, at: now };

    const t = setTimeout(() => {
      void fetch("/api/me/activity/page-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ path: pathname }),
      }).catch(() => {});
    }, 400);

    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}

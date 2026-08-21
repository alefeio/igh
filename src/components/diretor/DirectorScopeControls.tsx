"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

type CycleOpt = { id: string; label: string; isCurrent: boolean };

export function DirectorScopeControls({
  cycles,
  loading,
  onRefresh,
}: {
  cycles: CycleOpt[];
  loading?: boolean;
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const scope = search.get("scope") ?? "current";
  const cycleId = search.get("cycleId") ?? "";

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(next)) {
        if (!v) sp.delete(k);
        else sp.set(k, v);
      }
      const q = sp.toString();
      router.push(q ? `${pathname}?${q}` : pathname);
    },
    [pathname, router, search],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={scope === "current" ? "primary" : "secondary"}
        onClick={() => setParams({ scope: "current", cycleId: null })}
      >
        Ciclo atual
      </Button>
      <Button
        size="sm"
        variant={scope === "all" ? "primary" : "secondary"}
        onClick={() => setParams({ scope: "all", cycleId: null })}
      >
        Relatório geral
      </Button>
      <Button
        size="sm"
        variant={scope === "cycle" ? "primary" : "secondary"}
        onClick={() =>
          setParams({
            scope: "cycle",
            cycleId: cycleId || cycles.find((c) => c.isCurrent)?.id || cycles[0]?.id || null,
          })
        }
      >
        Outro ciclo
      </Button>
      {scope === "cycle" ? (
        <select
          className="rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
          value={cycleId}
          onChange={(e) => setParams({ scope: "cycle", cycleId: e.target.value })}
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
              {c.isCurrent ? " (atual)" : ""}
            </option>
          ))}
        </select>
      ) : null}
      {onRefresh ? (
        <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar"}
        </Button>
      ) : null}
    </div>
  );
}

export function useDirectorApiQuery() {
  const search = useSearchParams();
  return useMemo(() => {
    const sp = new URLSearchParams();
    const scope = search.get("scope") ?? "current";
    sp.set("scope", scope);
    const cycleId = search.get("cycleId");
    if (scope === "cycle" && cycleId) sp.set("cycleId", cycleId);
    const courseId = search.get("courseId");
    if (courseId) sp.set("courseId", courseId);
    const poloId = search.get("poloId");
    if (poloId) sp.set("poloId", poloId);
    return sp.toString();
  }, [search]);
}

export function useFetchJson<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Falha ao carregar.");
        setData(null);
        return;
      }
      setData(json.data as T);
    } catch {
      setError("Falha de rede.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  return { data, error, loading, load, setData };
}

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

export function DirectorPeriodControls({
  loading,
  onRefresh,
  mode,
}: {
  loading?: boolean;
  onRefresh?: () => void;
  mode: "competence" | "range" | "year" | "execCompetence";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const competence = search.get("competence") ?? "";
  const execCompetence = search.get("execCompetence") ?? "";
  const from = search.get("from") ?? "";
  const to = search.get("to") ?? "";
  const year = search.get("year") ?? "";

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
      {mode === "execCompetence" ? (
        <label className="text-sm">
          Competência executiva
          <input
            type="month"
            className="ml-2 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1"
            value={execCompetence}
            onChange={(e) => setParams({ execCompetence: e.target.value || null })}
          />
        </label>
      ) : null}
      {mode === "competence" ? (
        <label className="text-sm">
          Competência
          <input
            type="month"
            className="ml-2 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1"
            value={competence}
            onChange={(e) => setParams({ competence: e.target.value || null, from: null, to: null })}
          />
        </label>
      ) : null}
      {mode === "range" ? (
        <>
          <label className="text-sm">
            De
            <input
              type="date"
              className="ml-2 rounded-md border px-2 py-1"
              value={from}
              onChange={(e) => setParams({ from: e.target.value || null })}
            />
          </label>
          <label className="text-sm">
            Até
            <input
              type="date"
              className="ml-2 rounded-md border px-2 py-1"
              value={to}
              onChange={(e) => setParams({ to: e.target.value || null })}
            />
          </label>
        </>
      ) : null}
      {mode === "year" ? (
        <label className="text-sm">
          Ano
          <input
            type="number"
            className="ml-2 w-24 rounded-md border px-2 py-1"
            value={year}
            onChange={(e) => setParams({ year: e.target.value || null })}
          />
        </label>
      ) : null}
      {onRefresh ? (
        <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar"}
        </Button>
      ) : null}
    </div>
  );
}

export function useDirectorApiQuery(keys?: string[]) {
  const search = useSearchParams();
  const keyList = keys?.join(",") ?? "";
  return useMemo(() => {
    const sp = new URLSearchParams();
    const allow = keyList ? keyList.split(",") : Array.from(search.keys());
    for (const k of allow) {
      const v = search.get(k);
      if (v) sp.set(k, v);
    }
    return sp.toString();
  }, [search, keyList]);
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

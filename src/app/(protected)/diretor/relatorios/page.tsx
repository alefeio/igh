"use client";

import { Suspense, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";
import { useFetchJson } from "@/components/diretor/DirectorScopeControls";

type Catalog = {
  catalog: Array<{ type: string; title: string; domain: string }>;
  formats: string[];
  notes: string[];
};

function Inner() {
  const { data, error, load } = useFetchJson<Catalog>("/api/diretor/reports");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void load();
  }, [load]);

  async function generate(type: string, format: "json" | "csv") {
    setMsg("Gerando…");
    const res = await fetch("/api/diretor/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, format }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setMsg(json?.error?.message ?? "Falha na geração");
      return;
    }
    const blob = new Blob([json.data.body], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = json.data.filename;
    a.click();
    setMsg(`Gerado ${json.data.filename} (sem snapshot).`);
  }

  return (
    <PanelPageStack>
      <DashboardHero eyebrow="Relatórios" title="Gerar um recorte sob demanda?" />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {data?.notes.map((n) => (
        <p key={n} className="text-sm text-[var(--text-muted)]">
          {n}
        </p>
      ))}
      {msg ? <p className="text-sm">{msg}</p> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {(data?.catalog ?? []).map((r) => (
          <li key={r.type} className="rounded-xl border p-4">
            <p className="font-semibold">{r.title}</p>
            <p className="text-xs text-[var(--text-muted)]">{r.domain}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => void generate(r.type, "json")}>
                JSON
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void generate(r.type, "csv")}>
                CSV
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </PanelPageStack>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <Inner />
    </Suspense>
  );
}

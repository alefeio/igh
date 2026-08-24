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

  async function generate(type: string, format: "json" | "csv" | "pdf" | "xlsx") {
    setMsg("Gerando…");
    const res = await fetch("/api/diretor/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, format }),
    });
    if (!res.ok) {
      let message = "Falha na geração";
      try {
        const json = await res.json();
        message = json?.error?.message ?? message;
      } catch {
        /* binary error */
      }
      setMsg(message);
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(cd);
    const filename = match?.[1] ?? `diretor-${type}.${format}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(`Gerado ${filename} (sem snapshot).`);
  }

  const formats = (data?.formats ?? ["json", "csv", "pdf", "xlsx"]) as Array<"json" | "csv" | "pdf" | "xlsx">;

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Relatórios"
        title="Qual recorte documentar agora?"
        description="JSON, CSV, PDF e XLSX sob demanda. Sem snapshot. Sem lista nominal."
      />
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
            <div className="mt-3 flex flex-wrap gap-2">
              {formats.map((f) => (
                <Button key={f} size="sm" variant={f === "pdf" ? "primary" : "secondary"} onClick={() => void generate(r.type, f)}>
                  {f.toUpperCase()}
                </Button>
              ))}
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

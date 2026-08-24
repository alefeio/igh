"use client";

import { Suspense, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";
import {
  DirectorPeriodControls,
  DirectorScopeControls,
  useDirectorApiQuery,
  useFetchJson,
} from "@/components/diretor/DirectorScopeControls";

type Catalog = {
  catalog: Array<{ type: string; title: string; domain: string }>;
  formats: string[];
  notes: string[];
};

function Inner() {
  const qs = useDirectorApiQuery(["scope", "cycleId", "competence", "from", "to"]);
  const { data, error, load } = useFetchJson<Catalog>("/api/diretor/reports");
  const [msg, setMsg] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  useEffect(() => {
    void load();
  }, [load]);

  async function generate(type: string, format: "json" | "csv" | "pdf" | "xlsx") {
    setMsg("Gerando…");
    const params = new URLSearchParams(qs);
    const res = await fetch("/api/diretor/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        format,
        scope: params.get("scope") || undefined,
        cycleId: params.get("cycleId") || undefined,
        competence: params.get("competence") || undefined,
        from: params.get("from") || undefined,
        to: params.get("to") || undefined,
      }),
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
    setMsg(`Arquivo gerado: ${filename}`);
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Relatórios"
        title="Qual recorte documentar agora?"
        description="Gere relatórios consolidados com os mesmos indicadores apresentados na área da Direção. Escolha o período e o formato desejado."
        rightSlot={
          <div className="flex flex-col items-end gap-2">
            <DirectorScopeControls cycles={[]} loading={false} />
            <DirectorPeriodControls mode="competence" />
          </div>
        }
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
              <Button size="sm" onClick={() => void generate(r.type, "pdf")}>
                Baixar PDF
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void generate(r.type, "xlsx")}>
                Baixar Excel
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void generate(r.type, "csv")}>
                Baixar CSV
              </Button>
            </div>
            {showJson ? (
              <button type="button" className="mt-2 text-xs underline" onClick={() => void generate(r.type, "json")}>
                Dados técnicos (JSON)
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <button type="button" className="text-sm text-[var(--text-muted)] underline" onClick={() => setShowJson((v) => !v)}>
        {showJson ? "Ocultar dados técnicos" : "Dados técnicos"}
      </button>
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

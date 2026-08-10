"use client";

import { Target } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Goal = {
  id: string | null;
  year: number;
  computersTarget: number;
  peopleTarget: number;
  notes: string | null;
  computersDone: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export default function MetasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [computersTarget, setComputersTarget] = useState("0");
  const [peopleTarget, setPeopleTarget] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gerencia/metas", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ goals: Goal[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar metas.");
        return;
      }
      setGoals(json.data.goals);
      const current = json.data.goals.find((g) => g.year === Number(year)) ?? json.data.goals[0];
      if (current) {
        setYear(String(current.year));
        setComputersTarget(String(current.computersTarget));
        setPeopleTarget(String(current.peopleTarget));
        setNotes(current.notes ?? "");
      }
    } catch {
      toast.push("error", "Falha ao carregar metas.");
    } finally {
      setLoading(false);
    }
  }, [toast, year]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
  }, []);

  function selectGoal(g: Goal) {
    setYear(String(g.year));
    setComputersTarget(String(g.computersTarget));
    setPeopleTarget(String(g.peopleTarget));
    setNotes(g.notes ?? "");
  }

  async function save() {
    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000) {
      toast.push("error", "Informe um ano válido.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/gerencia/metas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: y,
          computersTarget: Number(computersTarget) || 0,
          peopleTarget: Number(peopleTarget) || 0,
          notes: notes.trim() || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ goal: Goal }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar meta.");
        return;
      }
      toast.push("success", `Meta de ${y} salva.`);
      void load();
    } catch {
      toast.push("error", "Falha ao salvar meta.");
    } finally {
      setSaving(false);
    }
  }

  const selected = goals.find((g) => g.year === Number(year));
  const computersDone = selected?.computersDone ?? 0;
  const computersTargetNum = Number(computersTarget) || 0;
  const pct =
    computersTargetNum > 0
      ? Math.min(100, Math.round((computersDone / computersTargetNum) * 100))
      : 0;

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Planejamento"
        title="Metas anuais"
        description="Defina quanto o IGH quer doar em computadores e quantas pessoas quer formar em cada ano."
        rightSlot={
          <Button onClick={() => void save()} disabled={saving || loading}>
            {saving ? "Salvando…" : "Salvar meta"}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Ano" value={year || "—"} icon={Target} />
        <StatTile
          label="Computadores doados"
          value={loading ? "—" : `${computersDone} / ${computersTargetNum}`}
          icon={Target}
          accent="emerald"
          sublabel={computersTargetNum > 0 ? `${pct}% da meta` : undefined}
        />
        <StatTile
          label="Pessoas a formar"
          value={loading ? "—" : peopleTarget}
          icon={Target}
          accent="sky"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <SectionCard title="Editar meta" description="Um registro por ano." variant="elevated">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm">Ano</span>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Computadores a doar</span>
              <Input
                type="number"
                min={0}
                value={computersTarget}
                onChange={(e) => setComputersTarget(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Pessoas a formar</span>
              <Input
                type="number"
                min={0}
                value={peopleTarget}
                onChange={(e) => setPeopleTarget(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Observações</span>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <Button className="w-full" onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Histórico" description="Metas cadastradas." variant="elevated">
          <Table>
            <thead>
              <tr>
                <Th>Ano</Th>
                <Th>Computadores</Th>
                <Th>Realizado</Th>
                <Th>Pessoas</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g.year}>
                  <Td className="font-medium">{g.year}</Td>
                  <Td>{g.computersTarget}</Td>
                  <Td>
                    {g.computersDone}
                    {g.computersTarget > 0
                      ? ` (${Math.min(100, Math.round((g.computersDone / g.computersTarget) * 100))}%)`
                      : ""}
                  </Td>
                  <Td>{g.peopleTarget}</Td>
                  <Td>
                    <Button size="sm" variant="secondary" onClick={() => selectGoal(g)}>
                      Editar
                    </Button>
                  </Td>
                </tr>
              ))}
              {!loading && goals.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
                    <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                      Nenhuma meta cadastrada.
                    </p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </SectionCard>
      </div>
    </PanelPageStack>
  );
}

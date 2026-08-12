"use client";

import { Plus, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
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

function blankForm(year: number) {
  return {
    year: String(year),
    computersTarget: "0",
    peopleTarget: "0",
    notes: "",
  };
}

export default function MetasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [computersTarget, setComputersTarget] = useState("0");
  const [peopleTarget, setPeopleTarget] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const savedGoals = useMemo(() => goals.filter((g) => g.id), [goals]);
  const selected = goals.find((g) => g.year === Number(year));
  const isNewYear = !selected?.id;

  const applyGoal = useCallback((g: Goal) => {
    setYear(String(g.year));
    setComputersTarget(String(g.computersTarget));
    setPeopleTarget(String(g.peopleTarget));
    setNotes(g.notes ?? "");
  }, []);

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
      const preferredYear = Number(year);
      const current =
        json.data.goals.find((g) => g.year === preferredYear) ??
        json.data.goals.find((g) => g.id) ??
        json.data.goals[0];
      if (current) applyGoal(current);
    } catch {
      toast.push("error", "Falha ao carregar metas.");
    } finally {
      setLoading(false);
    }
  }, [applyGoal, toast, year]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
  }, []);

  function startNewGoal() {
    const currentYear = new Date().getFullYear();
    const maxSaved = savedGoals.reduce((max, g) => Math.max(max, g.year), currentYear - 1);
    let nextYear = Math.max(currentYear, maxSaved + 1);
    const used = new Set(savedGoals.map((g) => g.year));
    while (used.has(nextYear)) nextYear += 1;
    const blank = blankForm(nextYear);
    setYear(blank.year);
    setComputersTarget(blank.computersTarget);
    setPeopleTarget(blank.peopleTarget);
    setNotes(blank.notes);
  }

  function onYearChange(raw: string) {
    setYear(raw);
    const y = Number(raw);
    if (!Number.isFinite(y) || y < 2000) return;
    const existing = goals.find((g) => g.year === y);
    if (existing?.id) {
      applyGoal(existing);
      return;
    }
    setComputersTarget("0");
    setPeopleTarget("0");
    setNotes("");
  }

  async function save() {
    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      toast.push("error", "Informe um ano válido (2000–2100).");
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
      toast.push("success", isNewYear ? `Meta de ${y} cadastrada.` : `Meta de ${y} atualizada.`);
      const saved = json.data.goal;
      setGoals((prev) => {
        const without = prev.filter((g) => g.year !== saved.year);
        return [saved, ...without].sort((a, b) => b.year - a.year);
      });
      applyGoal(saved);
    } catch {
      toast.push("error", "Falha ao salvar meta.");
    } finally {
      setSaving(false);
    }
  }

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
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={startNewGoal} disabled={loading}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Nova meta
            </Button>
            <Button onClick={() => void save()} disabled={saving || loading}>
              {saving ? "Salvando…" : isNewYear ? "Cadastrar meta" : "Salvar alterações"}
            </Button>
          </div>
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
          label="Pessoas a formar (meta)"
          value={loading ? "—" : peopleTarget}
          icon={Target}
          accent="sky"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <SectionCard
          title={isNewYear ? "Nova meta" : "Editar meta"}
          description={
            isNewYear
              ? "Informe o ano e as quantidades. Ao salvar, a meta entra no histórico."
              : "Altere os valores e salve. Um registro por ano."
          }
          variant="elevated"
        >
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm">Ano</span>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => onYearChange(e.target.value)}
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
              {saving ? "Salvando…" : isNewYear ? "Cadastrar meta" : "Salvar alterações"}
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Histórico" description="Metas já cadastradas." variant="elevated">
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
              {savedGoals.map((g) => (
                <tr key={g.id ?? g.year}>
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
                    <Button size="sm" variant="secondary" onClick={() => applyGoal(g)}>
                      Editar
                    </Button>
                  </Td>
                </tr>
              ))}
              {!loading &&
              goals.some((g) => !g.id && g.year === Number(year)) &&
              !savedGoals.some((g) => g.year === Number(year)) ? (
                <tr>
                  <Td className="font-medium">{year}</Td>
                  <Td colSpan={3}>
                    <span className="text-sm text-[var(--text-muted)]">Ainda não cadastrada</span>
                  </Td>
                  <Td>
                    <Badge tone="amber">Rascunho</Badge>
                  </Td>
                </tr>
              ) : null}
              {!loading && savedGoals.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <p className="text-sm text-[var(--text-muted)]">Nenhuma meta cadastrada ainda.</p>
                      <Button size="sm" onClick={startNewGoal}>
                        <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                        Cadastrar primeira meta
                      </Button>
                    </div>
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

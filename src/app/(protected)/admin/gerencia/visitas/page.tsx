"use client";

import { ClipboardCheck, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import type { TechnicalVisitClassification, TechnicalVisitItemStatus } from "@/generated/prisma/client";
import {
  DEFAULT_STRUCTURAL_STANDARDS,
  DEFAULT_TECHNICAL_VISIT_CHECKLIST,
} from "@/lib/technical-visit-defaults";
import type { DonatariaView } from "@/lib/inventory-donations-ui";
import {
  TECHNICAL_VISIT_CLASSIFICATION_LABEL,
  TECHNICAL_VISIT_ITEM_STATUS_LABEL,
  type TechnicalVisitView,
} from "@/lib/technical-visits-ui";

type ChecklistDraft = {
  key: string;
  label: string;
  standard: string;
  status: TechnicalVisitItemStatus;
  observation: string;
  sortOrder: number;
};

type FormState = {
  locationName: string;
  municipality: string;
  state: string;
  address: string;
  localContact: string;
  visitedAt: string;
  visitors: string;
  metaStudents: string;
  metaClassGroups: string;
  metaStudentsPerClass: string;
  classDuration: string;
  classesPerWeek: string;
  classDays: string;
  pedagogicalPlan: string;
  structuralStandards: string;
  finalClassification: TechnicalVisitClassification;
  finalNotes: string;
  donatariaId: string;
  checklist: ChecklistDraft[];
};

const CLASSIFICATION_LABEL = TECHNICAL_VISIT_CLASSIFICATION_LABEL;
const STATUS_LABEL = TECHNICAL_VISIT_ITEM_STATUS_LABEL;

function emptyChecklist(): ChecklistDraft[] {
  return DEFAULT_TECHNICAL_VISIT_CHECKLIST.map((item, index) => ({
    ...item,
    status: "PENDENTE",
    observation: "",
    sortOrder: index,
  }));
}

function emptyForm(): FormState {
  return {
    locationName: "",
    municipality: "",
    state: "PA",
    address: "",
    localContact: "",
    visitedAt: new Date().toISOString().slice(0, 10),
    visitors: "",
    metaStudents: "100",
    metaClassGroups: "5",
    metaStudentsPerClass: "20",
    classDuration: "1h15 min",
    classesPerWeek: "2 aulas por semana",
    classDays: "Terça e Quinta ou Quarta e Sexta",
    pedagogicalPlan: "Planejamento pedagógico",
    structuralStandards: DEFAULT_STRUCTURAL_STANDARDS,
    finalClassification: "APTA_COM_PENDENCIAS",
    finalNotes: "",
    donatariaId: "",
    checklist: emptyChecklist(),
  };
}

const selectClass =
  "w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm";

function classificationTone(
  c: TechnicalVisitClassification,
): "green" | "amber" | "red" {
  if (c === "APTA") return "green";
  if (c === "APTA_COM_PENDENCIAS") return "amber";
  return "red";
}

export default function VisitasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<TechnicalVisitView[]>([]);
  const [totals, setTotals] = useState({ registered: 0, aptas: 0, withPending: 0 });
  const [donatarias, setDonatarias] = useState<DonatariaView[]>([]);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<TechnicalVisitView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const [vRes, dRes] = await Promise.all([
        fetch(`/api/admin/gerencia/visitas${qs}`, { cache: "no-store" }),
        fetch("/api/admin/gerencia/donatarias", { cache: "no-store" }),
      ]);
      const vJson = (await vRes.json()) as ApiResponse<{
        visits: TechnicalVisitView[];
        totals: { registered: number; aptas: number; withPending: number };
      }>;
      const dJson = (await dRes.json()) as ApiResponse<{ donatarias: DonatariaView[] }>;
      if (!vRes.ok || !vJson.ok) {
        toast.push("error", !vJson.ok ? vJson.error.message : "Falha ao carregar visitas.");
        return;
      }
      setVisits(vJson.data.visits);
      setTotals(vJson.data.totals);
      if (dRes.ok && dJson.ok) {
        setDonatarias(dJson.data.donatarias.filter((d) => d.isActive));
      }
    } catch {
      toast.push("error", "Falha ao carregar visitas.");
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const okProgress = useMemo(() => {
    const ok = form.checklist.filter((c) => c.status === "OK").length;
    return `${ok}/${form.checklist.length} OK`;
  }, [form.checklist]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(v: TechnicalVisitView) {
    setEditingId(v.id);
    setForm({
      locationName: v.locationName,
      municipality: v.municipality,
      state: v.state,
      address: v.address ?? "",
      localContact: v.localContact ?? "",
      visitedAt: v.visitedAt.slice(0, 10),
      visitors: v.visitors ?? "",
      metaStudents: v.metaStudents != null ? String(v.metaStudents) : "",
      metaClassGroups: v.metaClassGroups != null ? String(v.metaClassGroups) : "",
      metaStudentsPerClass: v.metaStudentsPerClass != null ? String(v.metaStudentsPerClass) : "",
      classDuration: v.classDuration ?? "",
      classesPerWeek: v.classesPerWeek ?? "",
      classDays: v.classDays ?? "",
      pedagogicalPlan: v.pedagogicalPlan ?? "",
      structuralStandards: v.structuralStandards ?? DEFAULT_STRUCTURAL_STANDARDS,
      finalClassification: v.finalClassification,
      finalNotes: v.finalNotes ?? "",
      donatariaId: v.donatariaId ?? "",
      checklist:
        v.checklistItems.length > 0
          ? v.checklistItems.map((item, index) => ({
              key: item.key,
              label: item.label,
              standard: item.standard,
              status: item.status,
              observation: item.observation ?? "",
              sortOrder: item.sortOrder ?? index,
            }))
          : emptyChecklist(),
    });
    setViewing(null);
    setFormOpen(true);
  }

  function setChecklistStatus(index: number, status: TechnicalVisitItemStatus) {
    setForm((prev) => {
      const checklist = [...prev.checklist];
      checklist[index] = { ...checklist[index], status };
      return { ...prev, checklist };
    });
  }

  function setChecklistObs(index: number, observation: string) {
    setForm((prev) => {
      const checklist = [...prev.checklist];
      checklist[index] = { ...checklist[index], observation };
      return { ...prev, checklist };
    });
  }

  async function save() {
    if (!form.locationName.trim() || !form.municipality.trim()) {
      toast.push("error", "Informe local e município.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        locationName: form.locationName.trim(),
        municipality: form.municipality.trim(),
        state: form.state.trim() || "PA",
        address: form.address.trim() || null,
        localContact: form.localContact.trim() || null,
        visitedAt: form.visitedAt,
        visitors: form.visitors.trim() || null,
        metaStudents: form.metaStudents ? Number(form.metaStudents) : null,
        metaClassGroups: form.metaClassGroups ? Number(form.metaClassGroups) : null,
        metaStudentsPerClass: form.metaStudentsPerClass
          ? Number(form.metaStudentsPerClass)
          : null,
        classDuration: form.classDuration.trim() || null,
        classesPerWeek: form.classesPerWeek.trim() || null,
        classDays: form.classDays.trim() || null,
        pedagogicalPlan: form.pedagogicalPlan.trim() || null,
        structuralStandards: form.structuralStandards.trim() || null,
        finalClassification: form.finalClassification,
        finalNotes: form.finalNotes.trim() || null,
        donatariaId: form.donatariaId || null,
        checklistItems: form.checklist.map((c) => ({
          key: c.key,
          label: c.label,
          standard: c.standard,
          status: c.status,
          observation: c.observation.trim() || null,
          sortOrder: c.sortOrder,
        })),
      };
      const res = await fetch(
        editingId ? `/api/admin/gerencia/visitas/${editingId}` : "/api/admin/gerencia/visitas",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json()) as ApiResponse<{ visit: TechnicalVisitView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar visita.");
        return;
      }
      toast.push("success", editingId ? "Visita atualizada." : "Checklist salvo.");
      setFormOpen(false);
      setEditingId(null);
      void load();
    } catch {
      toast.push("error", "Falha ao salvar visita.");
    } finally {
      setSaving(false);
    }
  }

  async function archive(v: TechnicalVisitView) {
    if (!confirm(`Arquivar visita em ${v.locationName}?`)) return;
    const res = await fetch(`/api/admin/gerencia/visitas/${v.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ archived: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao arquivar.");
      return;
    }
    toast.push("success", "Visita arquivada.");
    void load();
  }

  function formatDate(iso: string) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência · Implantação"
        title="Visitas técnicas"
        description="Registre a vistoria do laboratório, valide pendências e mantenha o histórico."
        rightSlot={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova visita
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Visitas registradas"
          value={loading ? "—" : totals.registered}
          icon={ClipboardCheck}
        />
        <StatTile
          label="Aptas"
          value={loading ? "—" : totals.aptas}
          icon={ClipboardCheck}
          accent="emerald"
        />
        <StatTile
          label="Com pendências"
          value={loading ? "—" : totals.withPending}
          icon={ClipboardCheck}
          accent="amber"
        />
      </div>

      <SectionCard title="Histórico de visitas" description="Locais vistoriados." variant="elevated">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              className="pl-9"
              placeholder="Buscar por local, município ou responsável"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Local</Th>
              <Th>Checklist</Th>
              <Th>Classificação</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => (
              <tr key={v.id}>
                <Td className="whitespace-nowrap">{formatDate(v.visitedAt)}</Td>
                <Td>
                  <div className="font-medium">{v.locationName}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {v.municipality}/{v.state}
                    {v.localContact ? ` · ${v.localContact}` : ""}
                  </div>
                </Td>
                <Td>
                  {v.okCount}/{v.checklistTotal} OK
                  {v.pendingCount > 0 ? (
                    <span className="ml-1 text-xs text-amber-600">({v.pendingCount} pend.)</span>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={classificationTone(v.finalClassification)}>
                    {CLASSIFICATION_LABEL[v.finalClassification]}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setViewing(v)}>
                      Ver
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(v)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void archive(v)}>
                      Arquivar
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {!loading && visits.length === 0 ? (
              <tr>
                <Td colSpan={5}>
                  <div className="flex flex-col items-center gap-3 py-8">
                    <p className="text-center text-sm text-[var(--text-muted)]">
                      Nenhuma visita registrada ainda.
                    </p>
                    <Button onClick={openCreate}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Registrar primeira visita
                    </Button>
                  </div>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </SectionCard>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
        title={
          editingId
            ? "Editar visita técnica"
            : "Protocolo de implementação — Nova visita técnica"
        }
      >
        <div className="grid max-h-[75vh] gap-4 overflow-y-auto pr-1">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">1. Identificação da visita</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm">Nome do local *</span>
                <Input
                  value={form.locationName}
                  onChange={(e) => setForm((f) => ({ ...f, locationName: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">Município *</span>
                <Input
                  value={form.municipality}
                  onChange={(e) => setForm((f) => ({ ...f, municipality: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">UF</span>
                <Input
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm">Endereço</span>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">Responsável no local</span>
                <Input
                  value={form.localContact}
                  onChange={(e) => setForm((f) => ({ ...f, localContact: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">Data</span>
                <Input
                  type="date"
                  value={form.visitedAt}
                  onChange={(e) => setForm((f) => ({ ...f, visitedAt: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm">Visitadores / equipe</span>
                <Input
                  value={form.visitors}
                  onChange={(e) => setForm((f) => ({ ...f, visitors: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm">Donatária (opcional)</span>
                <select
                  className={selectClass}
                  value={form.donatariaId}
                  onChange={(e) => setForm((f) => ({ ...f, donatariaId: e.target.value }))}
                >
                  <option value="">Sem vínculo</option>
                  {donatarias.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">2. Meta pedagógica</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--text-muted)]">Alunos</span>
                <Input
                  value={form.metaStudents}
                  onChange={(e) => setForm((f) => ({ ...f, metaStudents: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--text-muted)]">Turmas</span>
                <Input
                  value={form.metaClassGroups}
                  onChange={(e) => setForm((f) => ({ ...f, metaClassGroups: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--text-muted)]">Por turma</span>
                <Input
                  value={form.metaStudentsPerClass}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, metaStudentsPerClass: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--text-muted)]">Carga</span>
                <Input
                  value={form.classDuration}
                  onChange={(e) => setForm((f) => ({ ...f, classDuration: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--text-muted)]">Aulas/semana</span>
                <Input
                  value={form.classesPerWeek}
                  onChange={(e) => setForm((f) => ({ ...f, classesPerWeek: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--text-muted)]">Dias</span>
                <Input
                  value={form.classDays}
                  onChange={(e) => setForm((f) => ({ ...f, classDays: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-4">
                <span className="mb-1 block text-xs text-[var(--text-muted)]">Planejamento</span>
                <Input
                  value={form.pedagogicalPlan}
                  onChange={(e) => setForm((f) => ({ ...f, pedagogicalPlan: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">3. Padrão estrutural do laboratório</h3>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              value={form.structuralStandards}
              onChange={(e) => setForm((f) => ({ ...f, structuralStandards: e.target.value }))}
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">4. Checklist de implementação</h3>
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {okProgress}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Marque cada item como OK, pendente ou não aplicável.
            </p>
            <div className="space-y-2">
              {form.checklist.map((item, index) => (
                <div
                  key={item.key}
                  className="grid gap-2 rounded-md border border-[var(--card-border)] p-2 sm:grid-cols-[1fr_140px_1fr]"
                >
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{item.standard}</div>
                  </div>
                  <select
                    className={selectClass}
                    value={item.status}
                    onChange={(e) =>
                      setChecklistStatus(index, e.target.value as TechnicalVisitItemStatus)
                    }
                  >
                    {(Object.keys(STATUS_LABEL) as TechnicalVisitItemStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Observação / ação necessária"
                    value={item.observation}
                    onChange={(e) => setChecklistObs(index, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">5. Classificação final</h3>
            <label className="block">
              <span className="mb-1 block text-sm">Resultado</span>
              <select
                className={selectClass}
                value={form.finalClassification}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    finalClassification: e.target.value as TechnicalVisitClassification,
                  }))
                }
              >
                {(Object.keys(CLASSIFICATION_LABEL) as TechnicalVisitClassification[]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {CLASSIFICATION_LABEL[c]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">
                Observações finais, encaminhamentos e prazo
              </span>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                value={form.finalNotes}
                onChange={(e) => setForm((f) => ({ ...f, finalNotes: e.target.value }))}
              />
            </label>
          </section>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setFormOpen(false);
              setEditingId(null);
            }}
          >
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Salvar checklist"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Visita — ${viewing.locationName}` : "Visita"}
      >
        {viewing ? (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{formatDate(viewing.visitedAt)}</strong> · {viewing.municipality}/
              {viewing.state}
            </p>
            <p className="text-[var(--text-muted)]">
              Responsável: {viewing.localContact || "—"} · Equipe: {viewing.visitors || "—"}
            </p>
            <Badge tone={classificationTone(viewing.finalClassification)}>
              {CLASSIFICATION_LABEL[viewing.finalClassification]}
            </Badge>
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th>Status</Th>
                  <Th>Obs.</Th>
                </tr>
              </thead>
              <tbody>
                {viewing.checklistItems.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <div className="font-medium">{i.label}</div>
                      <div className="text-xs text-[var(--text-muted)]">{i.standard}</div>
                    </Td>
                    <Td>{STATUS_LABEL[i.status]}</Td>
                    <Td>{i.observation || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {viewing.finalNotes ? (
              <p className="rounded-md bg-[var(--igh-surface)] p-3 text-[var(--text-muted)]">
                {viewing.finalNotes}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-3">
              <Button variant="secondary" onClick={() => openEdit(viewing)}>
                Editar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PanelPageStack>
  );
}

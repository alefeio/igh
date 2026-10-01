"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { ENROLLMENT_HISTORY_KIND_LABEL, type EnrollmentHistoryKindValue } from "@/lib/enrollment-history";
import { formatDateTime } from "@/lib/format";
import type { ApiResponse } from "@/lib/api-types";

type HistoryItem = {
  id: string;
  kind: EnrollmentHistoryKindValue;
  body: string;
  createdAt: string;
  authorName: string;
};

type EnrollmentRow = {
  id: string;
  statusLabel: string;
  studentName: string;
  courseName: string;
  teacherName: string;
  classGroupId: string;
  history: HistoryItem[];
};

type FeedItem = HistoryItem & {
  enrollmentId: string;
  statusLabel: string;
  studentName: string;
  courseName: string;
  teacherName: string;
  classGroupId: string;
};

type Payload = {
  cycle: { id: string; label: string } | null;
  teachers: { id: string; name: string }[];
  classGroups: { id: string; teacherId: string; label: string }[];
  view: "cronologico" | "turma";
  feed: FeedItem[];
  enrollments: EnrollmentRow[];
};

const selectClass = "h-10 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3";

function HistoryList({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">Nenhum registro ainda.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((entry) => (
        <li key={entry.id} className="rounded-md border border-[var(--card-border)] px-3 py-2">
          <p className="text-xs text-[var(--text-muted)]">
            {formatDateTime(entry.createdAt)} · {ENROLLMENT_HISTORY_KIND_LABEL[entry.kind] ?? entry.kind} · Registrado
            por {entry.authorName}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{entry.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function CoordenacaoBuscaAtiva({ initialQuery = "" }: { initialQuery?: string }) {
  const toast = useToast();
  const [cycles, setCycles] = useState<{ id: string; label: string }[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [classGroups, setClassGroups] = useState<{ id: string; label: string }[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useState<"cronologico" | "turma">("cronologico");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCycles = useCallback(async () => {
    const res = await fetch("/api/coordenacao/matriculas", { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ cycles: { id: string; label: string }[]; cycle: { id: string } | null }>;
    if (res.ok && json.ok) {
      setCycles(json.data.cycles.map((cycle) => ({ id: cycle.id, label: cycle.label })));
      if (json.data.cycle) setCycleId((current) => current || json.data.cycle!.id);
    }
  }, []);

  const loadRows = useCallback(async (id: string, q: string, teacher: string, turma: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ cycleId: id, q });
      if (teacher) params.set("teacherId", teacher);
      if (turma) params.set("classGroupId", turma);
      const res = await fetch(`/api/coordenacao/busca-ativa?${params}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || !json.ok) return;
      setTeachers(json.data.teachers);
      setClassGroups(json.data.classGroups);
      setView(json.data.view);
      setFeed(json.data.feed);
      setRows(json.data.enrollments);
      if (turma && !json.data.classGroups.some((group) => group.id === turma)) {
        setClassGroupId("");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCycles();
  }, [loadCycles]);

  useEffect(() => {
    if (cycleId) void loadRows(cycleId, query, teacherId, classGroupId);
  }, [cycleId, loadRows, query, teacherId, classGroupId]);

  async function addNote(enrollmentId: string) {
    const text = (drafts[enrollmentId] ?? "").trim();
    if (text.length < 2) {
      toast.push("error", "Escreva a informação da busca ativa.");
      return;
    }
    setSavingId(enrollmentId);
    try {
      const res = await fetch("/api/coordenacao/busca-ativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, body: text }),
      });
      const json = (await res.json()) as ApiResponse<{ entry: HistoryItem }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Não foi possível registrar.");
        return;
      }
      setDrafts((prev) => ({ ...prev, [enrollmentId]: "" }));
      const entry = json.data.entry;
      setRows((prev) =>
        prev.map((row) => (row.id === enrollmentId ? { ...row, history: [entry, ...row.history] } : row)),
      );
      setFeed((prev) => {
        const sample = prev.find((item) => item.enrollmentId === enrollmentId);
        const fromRow = rows.find((row) => row.id === enrollmentId);
        if (!sample && !fromRow) return prev;
        return [
          {
            ...entry,
            enrollmentId,
            statusLabel: sample?.statusLabel ?? fromRow?.statusLabel ?? "",
            studentName: sample?.studentName ?? fromRow?.studentName ?? "",
            courseName: sample?.courseName ?? fromRow?.courseName ?? "",
            teacherName: sample?.teacherName ?? fromRow?.teacherName ?? "",
            classGroupId: sample?.classGroupId ?? fromRow?.classGroupId ?? "",
          },
          ...prev,
        ];
      });
      toast.push("success", "Informação registrada no histórico.");
    } finally {
      setSavingId(null);
    }
  }

  function noteForm(enrollmentId: string) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <textarea
          className="theme-input min-h-[88px] w-full rounded-md border px-3 py-2 text-sm"
          maxLength={2000}
          placeholder="Nova informação de busca ativa"
          value={drafts[enrollmentId] ?? ""}
          onChange={(event) => setDrafts((prev) => ({ ...prev, [enrollmentId]: event.target.value }))}
        />
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={savingId === enrollmentId} onClick={() => void addNote(enrollmentId)}>
            {savingId === enrollmentId ? "Salvando…" : "Registrar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardHero
        eyebrow="Coordenação"
        title="Interações dos professores"
        description="Por padrão, as interações mais recentes. Selecione uma turma para ver os alunos organizados."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
          Ciclo
          <select className={selectClass} value={cycleId} onChange={(event) => {
            setCycleId(event.target.value);
            setClassGroupId("");
            setTeacherId("");
          }}>
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
          Professor
          <select
            className={selectClass}
            value={teacherId}
            onChange={(event) => {
              setTeacherId(event.target.value);
              setClassGroupId("");
            }}
          >
            <option value="">Todos</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
          Turma
          <select className={selectClass} value={classGroupId} onChange={(event) => setClassGroupId(event.target.value)}>
            <option value="">Todas — ordem cronológica</option>
            {classGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
          Aluno
          <input
            className="theme-input h-10 rounded-md border px-3"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome do aluno"
          />
        </label>
      </div>
      {loading ? <p className="text-sm text-[var(--text-muted)]">Carregando…</p> : null}
      {!loading && view === "cronologico" && feed.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhuma interação neste filtro.</p>
      ) : null}
      {!loading && view === "turma" && rows.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhum aluno nesta turma.</p>
      ) : null}

      {view === "cronologico" ? (
        <div className="flex flex-col gap-4">
          {feed.map((item) => (
            <SectionCard
              key={item.id}
              title={item.studentName}
              description={`${item.courseName} · Professor ${item.teacherName} · ${item.statusLabel}`}
              variant="elevated"
            >
              <HistoryList items={[item]} />
              {noteForm(item.enrollmentId)}
            </SectionCard>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <SectionCard
              key={row.id}
              title={row.studentName}
              description={`${row.courseName} · Professor ${row.teacherName} · ${row.statusLabel}`}
              variant="elevated"
            >
              <HistoryList items={row.history} />
              {noteForm(row.id)}
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}

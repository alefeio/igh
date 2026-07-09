"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, RefreshCw } from "lucide-react";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type OccurrenceRow = {
  holidayId: string;
  occurrenceDate: string;
  registrationsCount: number;
  holiday: {
    id: string;
    name: string | null;
    subtitle: string | null;
    recurring: boolean;
    eventStartTime: string | null;
    eventEndTime: string | null;
  };
};

type RegistrationRow = {
  id: string;
  holidayId: string;
  userId: string;
  occurrenceDate: string;
  createdAt: string;
  present: boolean | null;
  attendanceMarkedAt: string | null;
  certificateUrl: string | null;
  certificateFileName: string | null;
  user: { id: string; name: string; email: string };
};

async function parseApiJson<T>(res: Response): Promise<ApiResponse<T> | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return null;
  }
}

function formatDateLong(ymd: string): string {
  const d = new Date(ymd + "T12:00:00.000Z");
  return d.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatHm(hm: string | null): string {
  return hm?.trim()?.slice(0, 5) ?? "";
}

export function TeacherHolidayEventAttendanceClient() {
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([]);
  const [selected, setSelected] = useState<{ holidayId: string; occurrenceDate: string } | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadOccurrences() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/holiday-events/occurrences?scope=${scope}`);
      const json = await parseApiJson<{ occurrences: OccurrenceRow[] }>(res);
      if (!res.ok || !json || !json.ok) {
        setOccurrences([]);
        return;
      }
      setOccurrences(json.data.occurrences ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadRegistrations(p: { holidayId: string; occurrenceDate: string }) {
    setLoadingRegs(true);
    try {
      const params = new URLSearchParams({ holidayId: p.holidayId, occurrenceDate: p.occurrenceDate });
      const res = await fetch(`/api/teacher/holiday-events/registrations?${params.toString()}`);
      const json = await parseApiJson<{ registrations: RegistrationRow[] }>(res);
      if (!res.ok || !json || !json.ok) {
        setRegistrations([]);
        return;
      }
      setRegistrations(json.data.registrations ?? []);
    } finally {
      setLoadingRegs(false);
    }
  }

  useEffect(() => {
    void loadOccurrences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const selectedOccurrence = useMemo(() => {
    if (!selected) return null;
    return occurrences.find((o) => o.holidayId === selected.holidayId && o.occurrenceDate === selected.occurrenceDate) ?? null;
  }, [occurrences, selected]);

  async function togglePresence(reg: RegistrationRow) {
    if (savingId) return;
    setSavingId(reg.id);
    try {
      const res = await fetch(`/api/teacher/holiday-events/registrations/${reg.id}/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ present: !(reg.present === true) }),
      });
      const json = await parseApiJson<{ registration: RegistrationRow }>(res);
      if (!res.ok || !json || !json.ok) return;
      setRegistrations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, ...json.data.registration } : r)));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <DashboardHero
        eyebrow="Professor"
        title="Eventos — presença dos inscritos"
        description="Selecione uma ocorrência de evento (data) e marque presença dos alunos inscritos."
        rightSlot={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <select
              className="theme-input h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)] sm:w-auto"
              value={scope}
              onChange={(e) => setScope(e.target.value === "past" ? "past" : "upcoming")}
            >
              <option value="upcoming">Próximos</option>
              <option value="past">Passados</option>
            </select>
            <Button type="button" variant="secondary" onClick={() => void loadOccurrences()} disabled={loading}>
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Ocorrências" description="Eventos com inscrições para você (professor responsável).">
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-3 font-semibold text-[var(--text-muted)]">Data</th>
                  <th className="py-2 pr-3 font-semibold text-[var(--text-muted)]">Evento</th>
                  <th className="py-2 pr-3 text-right font-semibold text-[var(--text-muted)]">Inscritos</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-sm text-[var(--text-muted)]">
                      Carregando…
                    </td>
                  </tr>
                ) : occurrences.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-sm text-[var(--text-muted)]">
                      Nenhuma ocorrência encontrada.
                    </td>
                  </tr>
                ) : (
                  occurrences.map((o) => {
                    const active = selected?.holidayId === o.holidayId && selected?.occurrenceDate === o.occurrenceDate;
                    return (
                      <tr
                        key={`${o.holidayId}:${o.occurrenceDate}`}
                        className={`cursor-pointer border-t transition hover:bg-[var(--igh-surface)]/60 ${
                          active ? "bg-[var(--igh-primary)]/5" : ""
                        }`}
                        onClick={() => {
                          setSelected({ holidayId: o.holidayId, occurrenceDate: o.occurrenceDate });
                          void loadRegistrations({ holidayId: o.holidayId, occurrenceDate: o.occurrenceDate });
                        }}
                      >
                        <td className="py-3 pr-3 align-top text-[var(--text-primary)]">{o.occurrenceDate}</td>
                        <td className="py-3 pr-3 align-top">
                          <div className="font-medium text-[var(--text-primary)]">{o.holiday.name ?? "Evento IGH"}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {o.holiday.subtitle ? `${o.holiday.subtitle} · ` : ""}
                            {formatHm(o.holiday.eventStartTime)}–{formatHm(o.holiday.eventEndTime)}
                          </div>
                        </td>
                        <td className="py-3 text-right align-top text-[var(--text-primary)]">{o.registrationsCount}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </TableShell>
        </SectionCard>

        <SectionCard
          title="Inscritos"
          description={
            selectedOccurrence
              ? `${formatDateLong(selectedOccurrence.occurrenceDate)} — ${selectedOccurrence.holiday.name ?? "Evento IGH"}`
              : "Selecione uma ocorrência para ver os inscritos."
          }
        >
          {!selectedOccurrence ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma ocorrência selecionada.</p>
          ) : loadingRegs ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando inscritos…</p>
          ) : registrations.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum inscrito nesta ocorrência.</p>
          ) : (
            <ul className="list-none space-y-2 pl-0">
              {registrations.map((r) => {
                const present = r.present === true;
                const disabled = savingId === r.id;
                return (
                  <li key={r.id} className="rounded-xl border border-[var(--igh-border)] bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[var(--text-primary)]">{r.user.name}</div>
                        <div className="truncate text-xs text-[var(--text-muted)]">{r.user.email}</div>
                      </div>
                      <Button type="button" variant={present ? "secondary" : "primary"} disabled={disabled} onClick={() => void togglePresence(r)}>
                        {present ? (
                          <>
                            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />
                            Presente
                          </>
                        ) : (
                          <>
                            <Circle className="mr-1.5 h-4 w-4" aria-hidden />
                            Marcar presente
                          </>
                        )}
                      </Button>
                    </div>
                    {present && r.certificateUrl ? (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Certificado:{" "}
                        <a
                          className="text-[var(--igh-primary)] underline hover:no-underline"
                          href={r.certificateUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.certificateFileName ?? "baixar"}
                        </a>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}


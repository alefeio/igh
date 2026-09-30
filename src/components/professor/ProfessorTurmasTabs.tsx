"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useUser } from "@/components/layout/UserProvider";
import {
  CertificatePagesSelect,
  certificatePagesQuery,
  type CertificatePagesMode,
} from "@/components/certificates/CertificatePagesSelect";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";
import {
  TEACHER_CLASS_GROUP_TABS,
  TEACHER_CLASS_GROUP_TAB_LABELS,
  type TeacherClassGroupTab,
} from "@/lib/teacher-class-group-tabs";

const STATUS_LABELS: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
};

type ClassGroupRow = {
  id: string;
  courseName: string;
  startDate: string;
  startTime: string;
  endTime: string;
  status: string;
  capacity: number;
  location: string | null;
  teacherName?: string;
  enrollmentsCount: number;
};

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(s: string) {
  const d = new Date(s);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function ProfessorTurmasTabs() {
  const toast = useToast();
  const user = useUser();
  const showAdminColumns = user.role === "ADMIN";
  const [activeTab, setActiveTab] = useState<TeacherClassGroupTab>("em_andamento");
  const [cache, setCache] = useState<Partial<Record<TeacherClassGroupTab, ClassGroupRow[]>>>({});
  const [loadingTab, setLoadingTab] = useState<TeacherClassGroupTab | null>("em_andamento");
  const [error, setError] = useState<string | null>(null);
  const [downloadingCertsId, setDownloadingCertsId] = useState<string | null>(null);
  const [downloadingListId, setDownloadingListId] = useState<string | null>(null);
  const [certificatePagesMode, setCertificatePagesMode] = useState<CertificatePagesMode>("both");
  const [courseFilter, setCourseFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const loadTab = useCallback(async (tab: TeacherClassGroupTab) => {
    setLoadingTab(tab);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/class-groups?tab=${tab}`);
      const json = (await res.json()) as ApiResponse<{ classGroups: ClassGroupRow[] }>;
      if (!res.ok || !json?.ok) {
        const msg =
          json && "error" in json
            ? ((json.error as { message?: string }).message ?? "Erro ao carregar turmas.")
            : "Erro ao carregar turmas.";
        setError(msg);
        return;
      }
      setCache((prev) => ({ ...prev, [tab]: json.data.classGroups ?? [] }));
    } finally {
      setLoadingTab((current) => (current === tab ? null : current));
    }
  }, []);

  useEffect(() => {
    void loadTab("em_andamento");
  }, [loadTab]);

  const handleTabChange = (tab: TeacherClassGroupTab) => {
    setActiveTab(tab);
    if (cache[tab] === undefined) {
      void loadTab(tab);
    }
  };

  async function downloadCertificates(cg: ClassGroupRow) {
    if (downloadingCertsId) return;
    setDownloadingCertsId(cg.id);
    try {
      const res = await fetch(
        `/api/class-groups/${cg.id}/certificates-zip?${certificatePagesQuery(certificatePagesMode)}`,
        {
        credentials: "include",
      },
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
        toast.push(
          "error",
          json && !json.ok ? json.error.message : "Falha ao baixar certificados.",
        );
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const fileName = match?.[1] ?? `certificados-${cg.id.slice(0, 8)}.zip`;
      const fileCount = Number.parseInt(res.headers.get("X-Certificate-File-Count") ?? "", 10);
      const expectedCount = Number.parseInt(
        res.headers.get("X-Certificate-Expected-Count") ?? "",
        10,
      );
      const errorCount = Number.parseInt(res.headers.get("X-Certificate-Errors") ?? "0", 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (
        Number.isFinite(fileCount) &&
        Number.isFinite(expectedCount) &&
        (errorCount > 0 || fileCount < expectedCount)
      ) {
        toast.push(
          "error",
          `ZIP baixado com ${fileCount} de ${expectedCount} certificados. Veja falhas.txt dentro do arquivo.`,
        );
      } else if (Number.isFinite(fileCount) && fileCount > 0) {
        toast.push("success", `Download iniciado: ${fileCount} certificado(s) no ZIP.`);
      } else {
        toast.push("success", "Download dos certificados iniciado.");
      }
    } catch {
      toast.push("error", "Falha ao baixar certificados.");
    } finally {
      setDownloadingCertsId(null);
    }
  }

  async function downloadSignoffList(cg: ClassGroupRow) {
    if (downloadingListId) return;
    setDownloadingListId(cg.id);
    try {
      const res = await fetch(`/api/class-groups/${cg.id}/certificate-signoff-list`, {
        credentials: "include",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
        toast.push(
          "error",
          json && !json.ok ? json.error.message : "Falha ao baixar a listagem.",
        );
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const fileName = match?.[1] ?? `listagem-${cg.id.slice(0, 8)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.push("success", "Download da listagem iniciado.");
    } catch {
      toast.push("error", "Falha ao baixar a listagem.");
    } finally {
      setDownloadingListId(null);
    }
  }
  const rows = cache[activeTab];
  const isLoading = loadingTab === activeTab && rows === undefined;
  const filteredRows = useMemo(() => {
    if (!rows) return rows;
    if (!showAdminColumns) return rows;
    const courseQuery = normalizeForSearch(courseFilter);
    const teacherQuery = normalizeForSearch(teacherFilter);
    const locationQuery = normalizeForSearch(locationFilter);
    if (!courseQuery && !teacherQuery && !locationQuery) return rows;
    return rows.filter((cg) => {
      const courseOk = !courseQuery || normalizeForSearch(cg.courseName).includes(courseQuery);
      const teacherOk = !teacherQuery || normalizeForSearch(cg.teacherName ?? "").includes(teacherQuery);
      const locationOk = !locationQuery || normalizeForSearch(cg.location ?? "").includes(locationQuery);
      return courseOk && teacherOk && locationOk;
    });
  }, [rows, showAdminColumns, courseFilter, teacherFilter, locationFilter]);
  const hasAdminFilter = showAdminColumns && (courseFilter.trim() || teacherFilter.trim() || locationFilter.trim());

  return (
    <SectionCard
      title={showAdminColumns ? "Turmas" : "Suas turmas"}
      description={
        filteredRows !== undefined
          ? filteredRows.length === 0
            ? hasAdminFilter
              ? "Nenhuma turma encontrada com esse filtro."
              : `Nenhuma turma ${TEACHER_CLASS_GROUP_TAB_LABELS[activeTab].toLowerCase()}.`
            : `${filteredRows.length} ${filteredRows.length === 1 ? "turma" : "turmas"}.`
          : "Carregando..."
      }
      variant="elevated"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--card-border)] pb-3">
        <div className="flex flex-wrap gap-2">
        {TEACHER_CLASS_GROUP_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--igh-primary)] text-white"
                  : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
              }`}
            >
              {TEACHER_CLASS_GROUP_TAB_LABELS[tab]}
            </button>
          );
        })}
        </div>
        <CertificatePagesSelect
          value={certificatePagesMode}
          onChange={setCertificatePagesMode}
        />
      </div>

      {showAdminColumns ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
            Curso
            <input
              type="search"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              placeholder="Nome do curso"
              className="theme-input h-10 w-full rounded-md border px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--igh-primary)]"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
            Professor
            <input
              type="search"
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              placeholder="Nome do professor"
              className="theme-input h-10 w-full rounded-md border px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--igh-primary)]"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
            Local
            <input
              type="search"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Local da turma"
              className="theme-input h-10 w-full rounded-md border px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--igh-primary)]"
            />
          </label>
        </div>
      ) : null}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-6 py-12 text-center text-[var(--text-muted)]">
          Carregando turmas...
        </div>
      ) : filteredRows && filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-6 py-12 text-center text-[var(--text-muted)]">
          {hasAdminFilter ? "Nenhuma turma encontrada com esse filtro." : "Nenhuma turma nesta categoria."}
        </div>
      ) : filteredRows && filteredRows.length > 0 ? (
        <TableShell>
          <thead>
            <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]">
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Curso</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">
                {showAdminColumns ? "Professor" : "Status"}
              </th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Início</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Horário</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Local</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Alunos</th>
              <th className="px-3 py-2 text-right font-medium text-[var(--text-primary)]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((cg) => (
              <tr key={cg.id} className="border-b border-[var(--card-border)] last:border-b-0">
                <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                  <Link
                    href={`/professor/turmas/${cg.id}`}
                    className="text-[var(--igh-primary)] hover:underline"
                  >
                    {cg.courseName}
                  </Link>
                </td>
                <td
                  className="max-w-[220px] truncate px-3 py-2 text-[var(--text-secondary)]"
                  title={showAdminColumns ? cg.teacherName : undefined}
                >
                  {showAdminColumns ? cg.teacherName?.trim() || "—" : STATUS_LABELS[cg.status] ?? cg.status}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{formatDate(cg.startDate)}</td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  {cg.startTime} – {cg.endTime}
                </td>
                <td
                  className="max-w-[200px] truncate px-3 py-2 text-[var(--text-secondary)]"
                  title={cg.location ?? undefined}
                >
                  {cg.location?.trim() ? cg.location : "—"}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  {cg.enrollmentsCount} / {cg.capacity}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={downloadingCertsId != null || cg.enrollmentsCount === 0}
                      onClick={() => void downloadCertificates(cg)}
                    >
                      {downloadingCertsId === cg.id ? "Gerando ZIP…" : "Baixar certificados"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={downloadingListId != null || cg.enrollmentsCount === 0}
                      onClick={() => void downloadSignoffList(cg)}
                    >
                      {downloadingListId === cg.id ? "Gerando PDF…" : "Baixar listagem"}
                    </Button>
                    <Link
                      href={`/professor/turmas/${cg.id}`}
                      className="inline-flex items-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)]"
                    >
                      Ver turma
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : null}
    </SectionCard>
  );
}

"use client";

import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Pencil,
  PhoneCall,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type ContactItem = {
  id: string;
  contactedAt: string;
  gotResponse: boolean;
  notes: string | null;
  contactedByName: string;
  contactedByUserId: string;
};

type SystemUserInfo = {
  userId: string | null;
  userName: string;
  studentId: string | null;
  enrolledInCurrentCycle: boolean;
  enrollments: Array<{
    enrollmentId: string;
    status: string;
    isPreEnrollment: boolean;
    courseName: string;
    classGroupLabel: string;
  }>;
};

type NextCycleInterestItem = {
  id: string;
  name: string;
  phone: string;
  email: string;
  courseIds: string[];
  courseNames: string[];
  customCourseName: string | null;
  source: string | null;
  createdAt: string;
  contactsCount: number;
  lastContact: ContactItem | null;
  contacts: ContactItem[];
  systemUser: SystemUserInfo | null;
};

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function whatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length >= 10 && !digits.startsWith("55") ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function enrollmentLabel(systemUser: SystemUserInfo | null): {
  short: string;
  detail: string | null;
  lines: string[];
  tone: "ok" | "warn" | "muted";
} {
  if (!systemUser) {
    return { short: "Sem cadastro", detail: null, lines: [], tone: "muted" };
  }

  const active = systemUser.enrollments.filter((e) => e.status === "ACTIVE");
  const others = systemUser.enrollments.filter((e) => e.status !== "ACTIVE");
  const lines = [...active, ...others].map((e) => {
    const hint = e.isPreEnrollment
      ? "pré-matrícula"
      : e.status === "SUSPENDED"
        ? "suspensa"
        : e.status === "COMPLETED"
          ? "concluída"
          : e.status === "ACTIVE"
            ? null
            : e.status.toLowerCase();
    const course = `${e.courseName}${e.classGroupLabel ? ` · ${e.classGroupLabel}` : ""}`;
    return hint ? `${course} (${hint})` : course;
  });

  if (systemUser.enrolledInCurrentCycle) {
    return {
      short: active.length > 1 ? `Matriculado (${active.length})` : "Matriculado",
      detail: lines.join(" · "),
      lines,
      tone: "ok",
    };
  }
  if (systemUser.enrollments.length > 0) {
    return {
      short: "Conta · sem matrícula ativa",
      detail: lines.join(" · "),
      lines,
      tone: "warn",
    };
  }
  return {
    short: systemUser.studentId ? "Cadastro · sem matrícula" : "Conta · sem matrícula",
    detail: systemUser.userName,
    lines: systemUser.userName ? [systemUser.userName] : [],
    tone: "warn",
  };
}

function ContactForm({
  target,
  mode,
  gotResponse,
  setGotResponse,
  contactNotes,
  setContactNotes,
  savingContact,
  onCancel,
  onSubmit,
}: {
  target: NextCycleInterestItem;
  mode: "create" | "edit";
  gotResponse: boolean;
  setGotResponse: (v: boolean) => void;
  contactNotes: string;
  setContactNotes: (v: string) => void;
  savingContact: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const enrollment = enrollmentLabel(target.systemUser);
  const history = target.contacts;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--text-muted)]">
        {mode === "edit"
          ? "Adicione uma nova interação. O histórico anterior é preservado."
          : "Registre que a equipe entrou em contato com este interessado. Seu nome será gravado automaticamente."}
      </p>

      {target.systemUser ? (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm">
          <div className="font-medium text-[var(--text-primary)]">
            Cadastro: {target.systemUser.userName}
          </div>
          <div className="mt-0.5 text-[var(--text-secondary)]">{enrollment.short}</div>
          {enrollment.lines.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[var(--text-secondary)]">
              {enrollment.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {mode === "edit" && history.length > 0 ? (
        <div>
          <div className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">
            Histórico de interações ({history.length})
          </div>
          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-2">
            {history.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-2.5 py-2 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-[var(--text-primary)]">{c.contactedByName}</span>
                  <span className="text-[var(--text-muted)]">{formatDateTime(c.contactedAt)}</span>
                </div>
                <div
                  className={
                    c.gotResponse
                      ? "mt-0.5 font-medium text-emerald-700 dark:text-emerald-400"
                      : "mt-0.5 text-[var(--text-muted)]"
                  }
                >
                  {c.gotResponse ? "Com resposta" : "Sem resposta"}
                </div>
                {c.notes ? (
                  <p className="mt-1 text-[var(--text-secondary)]">{c.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--text-primary)]">
        <Checkbox
          checked={gotResponse}
          onCheckedChange={setGotResponse}
          className="mt-0.5"
          aria-label="Conseguiu resposta do interessado"
        />
        <span>
          <span className="font-medium">Conseguiu resposta</span>
          <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
            Marque se o interessado respondeu a esta interação.
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor="contact-notes"
          className="mb-1 block text-xs font-medium text-[var(--text-muted)]"
        >
          Observações (opcional)
        </label>
        <textarea
          id="contact-notes"
          value={contactNotes}
          onChange={(e) => setContactNotes(e.target.value.slice(0, 500))}
          rows={3}
          maxLength={500}
          placeholder="Ex.: ligou às 14h, pediu retorno amanhã…"
          className="w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--igh-primary)]"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={savingContact}>
          Cancelar
        </Button>
        <Button type="button" onClick={onSubmit} disabled={savingContact}>
          {savingContact
            ? "Salvando…"
            : mode === "edit"
              ? "Adicionar interação"
              : "Registrar contato"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminPreInscricoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NextCycleInterestItem[]>([]);
  const [query, setQuery] = useState("");
  const [onlyNotEnrolled, setOnlyNotEnrolled] = useState(false);
  const [onlyNotContacted, setOnlyNotContacted] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [contactTarget, setContactTarget] = useState<NextCycleInterestItem | null>(null);
  const [contactMode, setContactMode] = useState<"create" | "edit">("create");
  const [gotResponse, setGotResponse] = useState(false);
  const [contactNotes, setContactNotes] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/next-cycle-interests");
      const json = (await res.json()) as ApiResponse<{ items: NextCycleInterestItem[] }>;
      if (!res.ok || !json?.ok) {
        toast.push(
          "error",
          json && !json.ok && "error" in json ? json.error.message : "Falha ao carregar.",
        );
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim());
    return items.filter((item) => {
      if (onlyNotEnrolled && item.systemUser?.enrolledInCurrentCycle) return false;
      if (onlyNotContacted && item.contactsCount > 0) return false;
      if (!q) return true;
      const enrollment = enrollmentLabel(item.systemUser);
      const haystack = normalizeSearch(
        [
          item.name,
          item.email,
          item.phone,
          formatPhone(item.phone),
          item.courseNames.join(" "),
          item.customCourseName ?? "",
          item.source ?? "",
          item.lastContact?.contactedByName ?? "",
          enrollment.short,
          enrollment.detail ?? "",
          ...enrollment.lines,
        ].join(" "),
      );
      return haystack.includes(q);
    });
  }, [items, query, onlyNotEnrolled, onlyNotContacted]);

  const summary = useMemo(() => {
    const todayStart = startOfLocalDay();
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    let today = 0;
    let last7Days = 0;
    let withCustomCourse = 0;
    let multiCourse = 0;
    let courseSelections = 0;
    let contacted = 0;
    let enrolled = 0;
    const courseCounts = new Map<string, number>();

    for (const item of items) {
      const created = new Date(item.createdAt);
      if (created >= todayStart) today += 1;
      if (created >= weekStart) last7Days += 1;
      if (item.customCourseName?.trim()) withCustomCourse += 1;
      if (item.contactsCount > 0) contacted += 1;
      if (item.systemUser?.enrolledInCurrentCycle) enrolled += 1;

      const listed = item.courseNames.filter((n) => !n.startsWith("Outro:"));
      const totalCourses = listed.length + (item.customCourseName?.trim() ? 1 : 0);
      if (totalCourses > 1) multiCourse += 1;
      courseSelections += totalCourses;

      for (const name of item.courseNames) {
        courseCounts.set(name, (courseCounts.get(name) ?? 0) + 1);
      }
    }

    const topCourses = [...courseCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .slice(0, 8);

    const avgCourses =
      items.length === 0 ? 0 : Math.round((courseSelections / items.length) * 10) / 10;

    return {
      total: items.length,
      today,
      last7Days,
      withCustomCourse,
      multiCourse,
      avgCourses,
      topCourses,
      distinctCourses: courseCounts.size,
      contacted,
      enrolled,
    };
  }, [items]);

  function openContactModal(item: NextCycleInterestItem, mode: "create" | "edit") {
    setContactTarget(item);
    setContactMode(mode);
    setGotResponse(false);
    setContactNotes("");
  }

  function closeContactModal() {
    if (savingContact) return;
    setContactTarget(null);
    setContactMode("create");
    setGotResponse(false);
    setContactNotes("");
  }

  async function submitContact() {
    if (!contactTarget || savingContact) return;
    setSavingContact(true);
    try {
      const res = await fetch("/api/admin/next-cycle-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interestId: contactTarget.id,
          gotResponse,
          notes: contactNotes.trim() || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ contact: ContactItem }>;
      if (!res.ok || !json?.ok) {
        toast.push(
          "error",
          json && !json.ok && "error" in json ? json.error.message : "Falha ao registrar contato.",
        );
        return;
      }
      const contact = json.data.contact;
      let updatedItem: NextCycleInterestItem | null = null;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== contactTarget.id) return item;
          const contacts = [contact, ...item.contacts];
          updatedItem = {
            ...item,
            contactsCount: item.contactsCount + 1,
            lastContact: contact,
            contacts,
          };
          return updatedItem;
        }),
      );
      toast.push("success", contactMode === "edit" ? "Interação adicionada." : "Contato registrado.");
      if (contactMode === "edit" && updatedItem) {
        setContactTarget(updatedItem);
        setGotResponse(false);
        setContactNotes("");
      } else {
        setContactTarget(null);
        setContactMode("create");
        setGotResponse(false);
        setContactNotes("");
      }
    } finally {
      setSavingContact(false);
    }
  }

  function exportExcel() {
    if (exporting || filtered.length === 0) return;
    setExporting(true);
    try {
      const rows = filtered.map((item) => {
        const enrollment = enrollmentLabel(item.systemUser);
        return {
          Data: formatDateTime(item.createdAt),
          Nome: item.name,
          "E-mail": item.email,
          Telefone: formatPhone(item.phone),
          Cursos: item.courseNames.join("; "),
          Contatos: item.contactsCount,
          "Último contato por": item.lastContact?.contactedByName ?? "",
          "Último contato em": item.lastContact ? formatDateTime(item.lastContact.contactedAt) : "",
          "Teve resposta": item.lastContact
            ? item.lastContact.gotResponse
              ? "Sim"
              : "Não"
            : "",
          "Matrícula ciclo atual": enrollment.short,
          "Cursos matriculados": enrollment.lines.join("; ") || enrollment.detail || "",
          Origem: item.source ?? "",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 20 },
        { wch: 28 },
        { wch: 32 },
        { wch: 16 },
        { wch: 50 },
        { wch: 10 },
        { wch: 22 },
        { wch: 20 },
        { wch: 12 },
        { wch: 22 },
        { wch: 50 },
        { wch: 12 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pré-inscrições");
      XLSX.writeFile(wb, `pre_inscricoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.push("success", "Relatório Excel exportado.");
    } catch {
      toast.push("error", "Falha ao exportar o Excel.");
    } finally {
      setExporting(false);
    }
  }

  const topCourseMax = summary.topCourses[0]?.[1] ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">
            Pré-inscrições — próximo ciclo
          </div>
          <div className="text-sm text-[var(--text-muted)]">
            Interessados cadastrados pelo formulário público /pre-inscricao. Registre contatos da
            equipe e acompanhe matrícula no ciclo atual.
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={exportExcel}
          disabled={loading || exporting || filtered.length === 0}
          className="w-full shrink-0 sm:w-auto"
        >
          {exporting ? "Exportando…" : "Exportar Excel"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total"
          value={loading ? "—" : summary.total}
          icon={ClipboardList}
          sublabel="pré-inscrições recebidas"
        />
        <StatTile
          label="Hoje"
          value={loading ? "—" : summary.today}
          icon={Sparkles}
          accent="emerald"
          sublabel="cadastradas neste dia"
        />
        <StatTile
          label="Contactados"
          value={loading ? "—" : summary.contacted}
          icon={PhoneCall}
          accent="sky"
          sublabel="com ao menos um contato"
        />
        <StatTile
          label="Matriculados"
          value={loading ? "—" : summary.enrolled}
          icon={Users}
          accent="amber"
          sublabel="conta + matrícula no ciclo atual"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Cursos mais pretendidos
            </h2>
          </div>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : summary.topCourses.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Ainda não há cursos selecionados nas pré-inscrições.
            </p>
          ) : (
            <ul className="list-none space-y-2.5 pl-0">
              {summary.topCourses.map(([name, count], index) => {
                const pct = topCourseMax > 0 ? Math.round((count / topCourseMax) * 100) : 0;
                return (
                  <li key={name}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-[var(--text-primary)]">
                        <span className="mr-2 font-semibold text-[var(--text-muted)]">
                          {index + 1}.
                        </span>
                        {name}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-[var(--igh-primary)]">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--igh-surface)]">
                      <div
                        className="h-full rounded-full bg-[var(--igh-primary)]/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Perfil das escolhas</h2>
          </div>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3">
                <dt className="text-[var(--text-muted)]">Mais de um curso marcado</dt>
                <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                  {summary.multiCourse}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3">
                <dt className="text-[var(--text-muted)]">Informaram “Outro” curso</dt>
                <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                  {summary.withCustomCourse}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Média de cursos por pessoa</dt>
                <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                  {summary.avgCourses}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
        <div className="max-w-md flex-1">
          <label
            htmlFor="pre-inscricoes-search"
            className="mb-1 block text-xs font-medium text-[var(--text-muted)]"
          >
            Buscar
          </label>
          <Input
            id="pre-inscricoes-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, e-mail, telefone, curso ou contato..."
          />
        </div>
        <div className="flex flex-col gap-2 pb-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:pb-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
            <Checkbox
              checked={onlyNotEnrolled}
              onCheckedChange={setOnlyNotEnrolled}
              aria-label="Somente não matriculados no ciclo atual"
            />
            <span>Somente não matriculados no ciclo atual</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
            <Checkbox
              checked={onlyNotContacted}
              onCheckedChange={setOnlyNotContacted}
              aria-label="Somente ainda não contactados"
            />
            <span>Somente ainda não contactados</span>
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            {filtered.length === items.length
              ? `${items.length} pré-inscrição(ões)`
              : `${filtered.length} de ${items.length} pré-inscrição(ões)`}
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Nome</Th>
                  <Th>Contato</Th>
                  <Th>Cursos</Th>
                  <Th>Último contato</Th>
                  <Th>Matrícula</Th>
                  <Th>Ação</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <Td colSpan={7} className="text-center text-[var(--text-muted)]">
                      {items.length === 0
                        ? "Nenhuma pré-inscrição recebida."
                        : "Nenhum resultado para a busca."}
                    </Td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const enrollment = enrollmentLabel(item.systemUser);
                    const last = item.lastContact;
                    return (
                      <tr key={item.id}>
                        <Td className="whitespace-nowrap text-sm text-[var(--text-muted)]">
                          {formatDateTime(item.createdAt)}
                        </Td>
                        <Td className="font-medium text-[var(--text-primary)]">{item.name}</Td>
                        <Td className="text-sm">
                          <div className="flex flex-col gap-0.5">
                            <a
                              href={`mailto:${item.email}`}
                              className="text-[var(--igh-primary)] hover:underline"
                            >
                              {item.email}
                            </a>
                            <a
                              href={whatsAppLink(item.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="whitespace-nowrap text-[var(--igh-primary)] hover:underline"
                              title="Abrir no WhatsApp"
                            >
                              {formatPhone(item.phone)}
                            </a>
                          </div>
                        </Td>
                        <Td className="max-w-xs text-sm text-[var(--text-secondary)]">
                          {item.courseNames.length > 0 ? (
                            <ul className="list-disc space-y-0.5 pl-4">
                              {item.courseNames.map((name) => (
                                <li key={`${item.id}-${name}`}>{name}</li>
                              ))}
                            </ul>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td className="min-w-[10rem] text-sm">
                          {last ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-[var(--text-primary)]">
                                {last.contactedByName}
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {formatDateTime(last.contactedAt)}
                              </span>
                              <span
                                className={
                                  last.gotResponse
                                    ? "text-xs font-medium text-emerald-700 dark:text-emerald-400"
                                    : "text-xs text-[var(--text-muted)]"
                                }
                              >
                                {last.gotResponse ? "Com resposta" : "Sem resposta"}
                                {item.contactsCount > 1
                                  ? ` · ${item.contactsCount} contatos`
                                  : ""}
                              </span>
                              {last.notes ? (
                                <span
                                  className="line-clamp-2 text-xs text-[var(--text-secondary)]"
                                  title={last.notes}
                                >
                                  {last.notes}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)]">Ainda não contactado</span>
                          )}
                        </Td>
                        <Td className="min-w-[11rem] text-sm">
                          <span
                            className={
                              enrollment.tone === "ok"
                                ? "font-medium text-emerald-700 dark:text-emerald-400"
                                : enrollment.tone === "warn"
                                  ? "font-medium text-amber-700 dark:text-amber-400"
                                  : "text-[var(--text-muted)]"
                            }
                          >
                            {enrollment.short}
                          </span>
                          {enrollment.lines.length > 0 ? (
                            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[var(--text-secondary)]">
                              {enrollment.lines.map((line) => (
                                <li key={`${item.id}-${line}`} title={line}>
                                  {line}
                                </li>
                              ))}
                            </ul>
                          ) : enrollment.detail ? (
                            <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
                              {enrollment.detail}
                            </div>
                          ) : null}
                        </Td>
                        <Td>
                          {item.contactsCount > 0 ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="whitespace-nowrap"
                              onClick={() => openContactModal(item, "edit")}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                              Editar
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="whitespace-nowrap"
                              onClick={() => openContactModal(item, "create")}
                            >
                              <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                              Contato
                            </Button>
                          )}
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </>
      )}

      <Modal
        open={!!contactTarget}
        onClose={closeContactModal}
        title={
          contactTarget
            ? contactMode === "edit"
              ? `Editar contatos — ${contactTarget.name}`
              : `Registrar contato — ${contactTarget.name}`
            : "Contato"
        }
        size="small"
      >
        {contactTarget ? (
          <ContactForm
            target={contactTarget}
            mode={contactMode}
            gotResponse={gotResponse}
            setGotResponse={setGotResponse}
            contactNotes={contactNotes}
            setContactNotes={setContactNotes}
            savingContact={savingContact}
            onCancel={closeContactModal}
            onSubmit={() => void submitContact()}
          />
        ) : null}
      </Modal>
    </div>
  );
}

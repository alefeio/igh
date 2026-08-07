"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site";
import type { ApiResponse } from "@/lib/api-types";
import { CadastroRapidoSection, INSCREVA_CADASTRO_RAPIDO_ID } from "./CadastroRapidoSection";
import { ClassGroupPicker } from "./ClassGroupPicker";
import { doOverlap, formatDateOnlyBR, type ClassGroupOption } from "./class-group-options";
import type { StudentData } from "./types";
import { cardClass, hintClass } from "./ui";
import { formatDaysShortPtBr } from "@/lib/turma-display";
import {
  classGroupPoloLabel,
  classGroupUnitLabel,
} from "@/lib/class-group-unit";

const EMPTY_TURMAS_INSCREVA_MSG = "No momento não há turmas abertas para inscrição.";
const MAX_ENROLLMENTS_PER_CYCLE = 2;

type CycleEnrollmentSummary = {
  cycleId: string;
  count: number;
  classGroupIds: string[];
};

type EnrollmentSuccess = {
  studentName: string;
  withoutEmail: boolean;
  kind: "enrollment" | "waitlist";
  turmas: {
    id: string;
    courseName: string;
    daysOfWeek: string[];
    startTime: string;
    endTime: string;
    startDate: string;
    unitLabel: string;
    waitlistPosition?: number;
  }[];
};

function turmaUnitLabel(cg: ClassGroupOption): string {
  const unitName = classGroupUnitLabel(cg.unit ?? null, cg.location);
  const polo = classGroupPoloLabel(cg.unit ?? null);
  return polo ? `${polo} · ${unitName}` : unitName;
}

function toDateOnlyString(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const part = value.trim().split("T")[0]?.split(" ")[0] ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function dateOnlyToUtcDate(dateOnly: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function canEnrollSameCourseAfterInProgressEnds(args: {
  courseId: string;
  candidateStartDate: string;
  inProgress: { courseId: string; startDate: string; endDate?: string | null }[];
}): boolean {
  const list = args.inProgress.filter((c) => c.courseId === args.courseId);
  if (list.length === 0) return false;
  const candStartStr = toDateOnlyString(args.candidateStartDate);
  const candStart = candStartStr ? dateOnlyToUtcDate(candStartStr) : null;
  if (!candStart) return false;

  let latestEnd: Date | null = null;
  for (const cg of list) {
    const endStr = toDateOnlyString(cg.endDate ?? cg.startDate);
    const end = endStr ? dateOnlyToUtcDate(endStr) : null;
    if (!end) return false; // conservador
    if (!latestEnd || end.getTime() > latestEnd.getTime()) latestEnd = end;
  }
  if (!latestEnd) return false;
  // Libera se a nova turma começar depois do fim da(s) turma(s) em andamento do mesmo curso.
  return candStart.getTime() > latestEnd.getTime();
}

export function InscrevaForm() {
  const searchParams = useSearchParams();
  const courseIdFromUrl = searchParams.get("courseId");
  const offerStatus = searchParams.get("offer");
  const offerCourse = searchParams.get("course");
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentData | null>(null);
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [classGroups, setClassGroups] = useState<ClassGroupOption[]>([]);
  const [selectedClassGroupIds, setSelectedClassGroupIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);
  /** Identificação só aparece quando o visitante já escolheu turma e vai enviar. */
  const [showIdentification, setShowIdentification] = useState(false);
  const identificationSectionRef = useRef<HTMLDivElement>(null);
  const [registeredWithoutEmail, setRegisteredWithoutEmail] = useState(false);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [enrolledClassGroupIds, setEnrolledClassGroupIds] = useState<string[]>([]);
  const [classGroupsEmAndamento, setClassGroupsEmAndamento] = useState<
    { courseId: string; startDate: string; endDate?: string | null }[]
  >([]);
  const [enrollmentsByCycle, setEnrollmentsByCycle] = useState<CycleEnrollmentSummary[]>([]);
  const [maxPerCycle, setMaxPerCycle] = useState(MAX_ENROLLMENTS_PER_CYCLE);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState<EnrollmentSuccess | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (options?: { ignoreCourseId?: boolean }) => {
    setLoading(true);
    try {
      const cgUrl =
        options?.ignoreCourseId
          ? "/api/public/class-groups"
          : courseIdFromUrl
            ? `/api/public/class-groups?courseId=${encodeURIComponent(courseIdFromUrl)}`
            : "/api/public/class-groups";
      const [meRes, cgRes] = await Promise.all([
        fetch("/api/me/student"),
        fetch(cgUrl),
      ]);
      const meJson = (await meRes.json()) as ApiResponse<{
        student: StudentData | null;
        enrolledCourseIds?: string[];
        enrolledClassGroupIds?: string[];
        classGroupsEmAndamento?: { courseId: string; startDate: string; endDate?: string | null }[];
        enrollmentsByCycle?: CycleEnrollmentSummary[];
        maxEnrollmentsPerCycle?: number;
      }>;
      const cgJson = (await cgRes.json()) as ApiResponse<{ classGroups: ClassGroupOption[] }>;
      if (meJson?.ok) {
        setStudent(meJson.data.student ?? null);
        setEnrolledCourseIds(meJson.data.enrolledCourseIds ?? []);
        setEnrolledClassGroupIds(meJson.data.enrolledClassGroupIds ?? []);
        setClassGroupsEmAndamento(meJson.data.classGroupsEmAndamento ?? []);
        setEnrollmentsByCycle(meJson.data.enrollmentsByCycle ?? []);
        setMaxPerCycle(meJson.data.maxEnrollmentsPerCycle ?? MAX_ENROLLMENTS_PER_CYCLE);
      }
      if (cgJson?.ok && cgJson.data.classGroups) {
        setClassGroups(cgJson.data.classGroups);
      }
    } finally {
      setLoading(false);
    }
  }, [courseIdFromUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCadastroRapido = useCallback(() => {
    setShowIdentification(true);
    setShowCadastro(true);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${INSCREVA_CADASTRO_RAPIDO_ID}`);
    }
  }, []);

  const closeCadastroRapido = useCallback(() => {
    setShowCadastro(false);
    if (
      typeof window !== "undefined" &&
      window.location.hash === `#${INSCREVA_CADASTRO_RAPIDO_ID}`
    ) {
      const q = window.location.search;
      window.history.replaceState(null, "", `${window.location.pathname}${q}`);
    }
  }, []);

  useEffect(() => {
    if (loading || student) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== `#${INSCREVA_CADASTRO_RAPIDO_ID}`) return;
    openCadastroRapido();
  }, [loading, student, openCadastroRapido]);

  useEffect(() => {
    if (!showIdentification || showCadastro || !identificationSectionRef.current) return;
    const el = identificationSectionRef.current;
    const t = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(t);
  }, [showIdentification, showCadastro]);

  useEffect(() => {
    if (!enrollmentSuccess || !successRef.current) return;
    const el = successRef.current;
    const t = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(t);
  }, [enrollmentSuccess]);

  const enrolledCountByCycle = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of enrollmentsByCycle) {
      m.set(row.cycleId, row.count);
    }
    return m;
  }, [enrollmentsByCycle]);

  const primaryCycleId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cg of classGroups) {
      if (!cg.cycleId) continue;
      counts.set(cg.cycleId, (counts.get(cg.cycleId) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [id, n] of counts) {
      if (n > bestN) {
        best = id;
        bestN = n;
      }
    }
    return best;
  }, [classGroups]);

  const enrolledInPrimaryCycle = primaryCycleId
    ? enrolledCountByCycle.get(primaryCycleId) ?? 0
    : 0;
  const slotsLeftInPrimaryCycle = Math.max(0, maxPerCycle - enrolledInPrimaryCycle);
  const showLimitBanner = student != null && slotsLeftInPrimaryCycle === 0 && classGroups.length > 0;

  function countSelectedInCycle(cycleId: string): number {
    return selectedClassGroupIds.filter((id) => {
      const cg = classGroups.find((c) => c.id === id);
      return cg?.cycleId === cycleId;
    }).length;
  }

  function slotsLeftForCycle(cycleId: string): number {
    const enrolled = enrolledCountByCycle.get(cycleId) ?? 0;
    return Math.max(0, maxPerCycle - enrolled - countSelectedInCycle(cycleId));
  }

  const selectedClassGroups = classGroups.filter((c) => selectedClassGroupIds.includes(c.id));

  function handleRegistered(newStudent: StudentData, token: string) {
    setStudent(newStudent);
    setStudentToken(token);
    setRegisteredWithoutEmail(!newStudent.email);
    setShowCadastro(false);
    setShowIdentification(false);
    toast.push(
      "success",
      newStudent.email
        ? "Cadastro realizado! Verifique seu e-mail para acessar a área do aluno. Agora confirme sua pré-matrícula."
        : "Cadastro realizado! Confirme sua pré-matrícula para finalizar."
    );
  }

  /**
   * Bloqueia turmas já matriculadas, cursos já matriculados (exceto reentrada após fim),
   * conflito de horário e teto de 2 matrículas ACTIVE por ciclo.
   */
  function isClassGroupOptionDisabled(cg: ClassGroupOption): boolean {
    if (selectedClassGroupIds.includes(cg.id)) return false;
    if (enrolledClassGroupIds.includes(cg.id)) return true;
    if (enrolledCourseIds.includes(cg.courseId)) {
      const canReEnrollSameCourse = canEnrollSameCourseAfterInProgressEnds({
        courseId: cg.courseId,
        candidateStartDate: cg.startDate,
        inProgress: classGroupsEmAndamento,
      });
      if (!canReEnrollSameCourse) return true;
    }
    if (cg.cycleId && slotsLeftForCycle(cg.cycleId) <= 0) return true;
    const selected = classGroups.filter((c) => selectedClassGroupIds.includes(c.id));
    if (selected.some((other) => doOverlap(other, cg))) return true;
    return false;
  }

  /** Aplica as regras de seleção (limite por ciclo e sobreposição) e alterna a turma escolhida. */
  function toggleClassGroup(cg: ClassGroupOption) {
    if (isClassGroupOptionDisabled(cg)) return;
    const selected = selectedClassGroupIds.includes(cg.id);
    if (!selected && cg.cycleId && slotsLeftForCycle(cg.cycleId) <= 0) {
      toast.push(
        "error",
        `Você já atingiu o limite de ${maxPerCycle} turmas neste ciclo.`,
      );
      return;
    }
    const newIds = selected
      ? selectedClassGroupIds.filter((id) => id !== cg.id)
      : [...selectedClassGroupIds, cg.id];
    if (!selected && cg.cycleId) {
      const enrolled = enrolledCountByCycle.get(cg.cycleId) ?? 0;
      const selectedInCycle = newIds.filter((id) => {
        const other = classGroups.find((c) => c.id === id);
        return other?.cycleId === cg.cycleId;
      }).length;
      if (enrolled + selectedInCycle > maxPerCycle) {
        toast.push(
          "error",
          `Você pode selecionar no máximo ${Math.max(0, maxPerCycle - enrolled)} turma(s) neste ciclo.`,
        );
        return;
      }
    }
    const newSelected = newIds
      .map((id) => classGroups.find((c) => c.id === id))
      .filter(Boolean) as ClassGroupOption[];
    for (let i = 0; i < newSelected.length; i++) {
      for (let j = i + 1; j < newSelected.length; j++) {
        if (doOverlap(newSelected[i]!, newSelected[j]!)) {
          toast.push("error", "Turmas no mesmo dia e horário não podem ser selecionadas juntas.");
          return;
        }
      }
    }
    setSelectedClassGroupIds(newIds);
  }

  async function handleEnrollment(e: React.FormEvent) {
    e.preventDefault();
    if (selectedClassGroupIds.length === 0 || submitting) return;
    // O visitante escolhe a turma primeiro; os dados pessoais só são pedidos aqui, no envio.
    if (!student) {
      setShowIdentification(true);
      return;
    }
    setSubmitting(true);
    try {
      const succeeded: {
        cg: ClassGroupOption;
        kind: "enrollment" | "waitlist";
        waitlistPosition?: number;
      }[] = [];
      for (const classGroupId of selectedClassGroupIds) {
        const cg = classGroups.find((c) => c.id === classGroupId);
        if (!cg) continue;
        const body: { classGroupId: string; studentToken?: string } = { classGroupId };
        if (studentToken) body.studentToken = studentToken;
        const isWaitlist = !!cg.waitlistOnly || (typeof cg.seatsLeft === "number" && cg.seatsLeft <= 0);
        const res = await fetch(isWaitlist ? "/api/public/waitlist" : "/api/public/enrollments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as ApiResponse<{
          enrollment?: { courseName: string };
          waitlist?: { position: number; courseName: string };
        }>;
        if (res.ok && json?.ok) {
          succeeded.push({
            cg,
            kind: isWaitlist ? "waitlist" : "enrollment",
            waitlistPosition: json.data.waitlist?.position,
          });
        } else {
          toast.push(
            "error",
            json && "error" in json
              ? json.error.message
              : isWaitlist
                ? "Erro ao entrar na lista de espera."
                : "Erro ao enviar pré-matrícula.",
          );
        }
      }
      if (succeeded.length > 0) {
        const newCourseIds = succeeded.map((s) => s.cg.courseId);
        const newClassGroupIds = succeeded.map((s) => s.cg.id);
        setEnrolledCourseIds((prev) => [...new Set([...prev, ...newCourseIds])]);
        setEnrolledClassGroupIds((prev) => [...new Set([...prev, ...newClassGroupIds])]);
        setEnrollmentsByCycle((prev) => {
          const next = new Map(prev.map((row) => [row.cycleId, { ...row, classGroupIds: [...row.classGroupIds] }]));
          for (const s of succeeded) {
            if (s.kind !== "enrollment" || !s.cg.cycleId) continue;
            const row = next.get(s.cg.cycleId) ?? {
              cycleId: s.cg.cycleId,
              count: 0,
              classGroupIds: [],
            };
            if (!row.classGroupIds.includes(s.cg.id)) {
              row.classGroupIds.push(s.cg.id);
              row.count = row.classGroupIds.length;
            }
            next.set(s.cg.cycleId, row);
          }
          return Array.from(next.values());
        });
        const kind = succeeded.every((s) => s.kind === "waitlist")
          ? "waitlist"
          : succeeded.every((s) => s.kind === "enrollment")
            ? "enrollment"
            : "enrollment";
        setEnrollmentSuccess({
          studentName: student.name,
          withoutEmail: registeredWithoutEmail,
          kind: succeeded.some((s) => s.kind === "waitlist") && !succeeded.some((s) => s.kind === "enrollment")
            ? "waitlist"
            : kind === "waitlist"
              ? "waitlist"
              : "enrollment",
          turmas: succeeded.map(({ cg, waitlistPosition }) => ({
            id: cg.id,
            courseName: cg.courseName,
            daysOfWeek: cg.daysOfWeek,
            startTime: cg.startTime,
            endTime: cg.endTime,
            startDate: cg.startDate,
            unitLabel: turmaUnitLabel(cg),
            waitlistPosition,
          })),
        });
        const waitCount = succeeded.filter((s) => s.kind === "waitlist").length;
        const enrollCount = succeeded.filter((s) => s.kind === "enrollment").length;
        if (waitCount > 0 && enrollCount === 0) {
          toast.push(
            "success",
            waitCount === 1
              ? "Reserva na lista de espera registrada. Você será matriculado automaticamente quando houver vaga."
              : `${waitCount} reservas na lista de espera registradas.`,
          );
        } else if (enrollCount > 0 && waitCount === 0) {
          toast.push(
            "success",
            enrollCount === 1
              ? "Pré-matrícula efetuada com sucesso."
              : `${enrollCount} pré-matrículas efetuadas com sucesso.`,
          );
        } else {
          toast.push(
            "success",
            `${enrollCount} pré-matrícula(s) e ${waitCount} reserva(s) registradas.`,
          );
        }
      }
      setSelectedClassGroupIds([]);
      if (succeeded.length === 0) {
        setStudentToken(null);
        setRegisteredWithoutEmail(false);
        void load({ ignoreCourseId: true });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function continueAfterSuccess() {
    setEnrollmentSuccess(null);
    setRegisteredWithoutEmail(false);
    setShowIdentification(false);
    void load({ ignoreCourseId: true });
  }

  if (loading) {
    return (
      <div className={cardClass}>
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--igh-primary)] border-t-transparent"
            aria-hidden
          />
          <p className="text-sm text-[var(--text-muted)]">Carregando as turmas disponíveis...</p>
        </div>
      </div>
    );
  }

  const offerBanner = (() => {
    if (!offerStatus) return null;
    if (offerStatus === "accepted") {
      return (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          Matrícula realizada{offerCourse ? ` em ${offerCourse}` : ""}. Verifique seu e-mail para
          confirmar a inscrição e acessar a plataforma.
        </div>
      );
    }
    const messages: Record<string, string> = {
      invalid: "Link de oferta inválido.",
      EXPIRED: "Esta oferta de vaga expirou.",
      FULL: "A vaga já foi preenchida. Escolha outra turma ou entre na lista de espera.",
      ALREADY_ENROLLED: "Você já possui matrícula ativa neste curso.",
      ALREADY_ACCEPTED: "Você já aceitou esta vaga.",
      CLASS_CLOSED: "Esta turma não está mais disponível.",
      NOT_FOUND: "Link de oferta inválido ou expirado.",
    };
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        {messages[offerStatus] ?? "Não foi possível aceitar a oferta de vaga."}
      </div>
    );
  })();

  if (enrollmentSuccess) {
    const { studentName, withoutEmail, turmas, kind } = enrollmentSuccess;
    const isWaitlist = kind === "waitlist";
    return (
      <div className="space-y-6">
        <div
          ref={successRef}
          className={`${cardClass} scroll-mt-24 border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/40`}
          role="status"
          aria-live="polite"
        >
          <div className="flex gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
              aria-hidden
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Concluído
              </p>
              <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                {isWaitlist ? "Reserva na lista de espera!" : "Pré-matrícula efetuada!"}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                {isWaitlist ? (
                  <>
                    Pronto, <strong>{studentName}</strong>. Você entrou na lista de espera
                    {turmas.length === 1 ? "" : ` de ${turmas.length} turmas`}. Quando houver vaga, você será
                    matriculado automaticamente e receberá um e-mail com as informações de acesso.
                  </>
                ) : turmas.length === 1 ? (
                  <>
                    Pronto, <strong>{studentName}</strong>. Sua pré-matrícula foi registrada com sucesso.
                  </>
                ) : (
                  <>
                    Pronto, <strong>{studentName}</strong>. Suas {turmas.length} pré-matrículas foram
                    registradas com sucesso.
                  </>
                )}
              </p>

              <ul className="mt-5 space-y-3">
                {turmas.map((turma) => (
                  <li
                    key={turma.id}
                    className="rounded-xl border border-emerald-200/80 bg-white/70 px-4 py-3 dark:border-emerald-800/60 dark:bg-emerald-950/30"
                  >
                    <p className="font-semibold text-[var(--text-primary)]">{turma.courseName}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {formatDaysShortPtBr(turma.daysOfWeek)} · {turma.startTime}–{turma.endTime}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {turma.unitLabel} · Início {formatDateOnlyBR(turma.startDate)}
                      {turma.waitlistPosition
                        ? ` · Posição na fila: ${turma.waitlistPosition}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>

              {withoutEmail ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-[var(--text-secondary)] dark:border-amber-800 dark:bg-amber-950/40">
                  <p className="font-semibold text-[var(--text-primary)]">Próximo passo na secretaria</p>
                  <p className="mt-1 leading-relaxed">
                    Como você não informou e-mail, compareça à secretaria para completar o cadastro e
                    entregar os documentos (documento de identidade e comprovante de residência). Anote
                    o CPF usado na inscrição para facilitar o atendimento.
                  </p>
                </div>
              ) : (
                <p className="mt-5 text-sm leading-relaxed text-[var(--text-muted)]">
                  {isWaitlist
                    ? "Guarde este comprovante. Assim que surgir uma vaga, enviaremos o e-mail de matrícula com os dados de acesso."
                    : "Guarde este comprovante. Se tiver conta no portal, você já pode acompanhar suas turmas na área do aluno. A confirmação final da matrícula é feita pela equipe do instituto."}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {!withoutEmail ? (
                  <Button as="link" href="/dashboard" variant="primary" size="lg">
                    Acessar área do aluno
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant={withoutEmail ? "primary" : "secondary"}
                  size="lg"
                  onClick={continueAfterSuccess}
                >
                  Inscrever em outra turma
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {offerBanner}
      {showLimitBanner ? (
        <div className={`${cardClass} border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/40`}>
          <p className="font-semibold text-[var(--text-primary)]">Limite de turmas neste ciclo atingido</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Você já está inscrito em {maxPerCycle} turmas neste ciclo. Não é possível se inscrever em outra
            turma. Entre em contato com a secretaria se precisar de ajuda.
          </p>
        </div>
      ) : (
        <form onSubmit={handleEnrollment} className="space-y-6">
          <div className={cardClass}>
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Escolha sua turma</h2>
              {student ? (
                <span
                  className="ml-auto rounded-full bg-[var(--igh-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)]"
                  aria-label={`Matrículas neste ciclo: ${enrolledInPrimaryCycle} de ${maxPerCycle}`}
                >
                  Neste ciclo: {enrolledInPrimaryCycle}/{maxPerCycle}
                </span>
              ) : null}
            </div>
            <p className={hintClass}>
              Selecione até {slotsLeftInPrimaryCycle > 0 ? slotsLeftInPrimaryCycle : maxPerCycle} turma(s)
              {student ? " restantes neste ciclo" : " por envio"}, sem sobreposição de dia e horário.
              Turmas lotadas entram na lista de espera: quando surgir vaga, a matrícula é feita
              automaticamente com e-mail de acesso.
            </p>
            <div className="mt-5">
              <ClassGroupPicker
                classGroups={classGroups}
                selectedIds={selectedClassGroupIds}
                onToggle={toggleClassGroup}
                isDisabled={isClassGroupOptionDisabled}
                emptyMessage={EMPTY_TURMAS_INSCREVA_MSG}
              />
            </div>
            {courseIdFromUrl && classGroups.length > 0 ? (
              <p className="mt-4">
                <a href="/inscreva" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
                  Ver todos os cursos
                </a>
              </p>
            ) : null}
          </div>

          {classGroups.length > 0 ? (
            <div className={`${cardClass} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
              <div className="min-w-0" aria-live="polite">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {selectedClassGroups.length === 0
                    ? "Nenhuma turma selecionada"
                    : selectedClassGroups.length === 1
                      ? "1 turma selecionada"
                      : `${selectedClassGroups.length} turmas selecionadas`}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {selectedClassGroups.length === 0
                    ? "Toque em uma turma acima para começar."
                    : selectedClassGroups.map((cg) => cg.courseName).join(" · ")}
                </p>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={submitting || selectedClassGroups.length === 0}
                className="w-full shrink-0 sm:w-auto"
              >
                {submitting
                  ? "Enviando..."
                  : student
                    ? "Enviar pré-matrícula"
                    : "Continuar"}
              </Button>
            </div>
          ) : null}
        </form>
      )}

      {!student && showIdentification && !showCadastro && (
        <div ref={identificationSectionRef} className={`scroll-mt-24 ${cardClass}`}>
          <h2 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Identifique-se</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Falta pouco: faça login se já tem cadastro ou cadastre-se para concluir a pré-matrícula.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Button
              as="link"
              href="/login?from=/inscreva"
              variant="primary"
              size="lg"
              className="min-h-[52px] w-full"
            >
              Fazer login
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="min-h-[52px] w-full"
              onClick={openCadastroRapido}
            >
              Cadastrar-se
            </Button>
          </div>
        </div>
      )}

      {!student && showCadastro && (
        <CadastroRapidoSection onRegistered={handleRegistered} onCancel={closeCadastroRapido} />
      )}

      {student && (
        <details className={cardClass}>
          <summary className="cursor-pointer text-lg font-bold text-[var(--text-primary)]">
            Seus dados
          </summary>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Nome</dt>
              <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{student.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">CPF</dt>
              <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                {student.cpf ? student.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Nascimento</dt>
              <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                {student.birthDate ? formatDateOnlyBR(student.birthDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Telefone</dt>
              <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{student.phone}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button as="link" href="/dashboard" variant="primary" size="lg">
              Acessar área do aluno
            </Button>
            <span className="text-xs text-[var(--text-muted)]">
              Não é você?{" "}
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  setEnrollmentSuccess(null);
                  setStudent(null);
                  setStudentToken(null);
                  setSelectedClassGroupIds([]);
                  setShowIdentification(false);
                  void load();
                }}
                className="font-semibold text-[var(--igh-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2 rounded"
              >
                Sair e fazer login com outra conta
              </button>
            </span>
          </div>
        </details>
      )}
    </div>
  );
}

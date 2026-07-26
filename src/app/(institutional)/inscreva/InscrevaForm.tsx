"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site";
import type { ApiResponse } from "@/lib/api-types";
import { CadastroRapidoSection, INSCREVA_CADASTRO_RAPIDO_ID } from "./CadastroRapidoSection";
import { ClassGroupPicker } from "./ClassGroupPicker";
import { doOverlap, formatDateOnlyBR, type ClassGroupOption } from "./class-group-options";
import type { StudentData } from "./types";
import { cardClass, hintClass } from "./ui";

const EMPTY_TURMAS_INSCREVA_MSG = "No momento não há turmas abertas para inscrição.";

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

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}

function overlapsWithTwoInProgress(
  candidate: { startDate: string; endDate?: string | null },
  inProgress: { startDate: string; endDate?: string | null }[],
): boolean {
  if (inProgress.length < 2) return false;
  const cStartStr = toDateOnlyString(candidate.startDate);
  const cEndStr = toDateOnlyString(candidate.endDate ?? candidate.startDate);
  const cStart = cStartStr ? dateOnlyToUtcDate(cStartStr) : null;
  const cEnd = cEndStr ? dateOnlyToUtcDate(cEndStr) : null;
  if (!cStart || !cEnd) return true; // conservador
  const overlapping = inProgress.filter((ip) => {
    const ipStartStr = toDateOnlyString(ip.startDate);
    const ipEndStr = toDateOnlyString(ip.endDate ?? ip.startDate);
    const ipStart = ipStartStr ? dateOnlyToUtcDate(ipStartStr) : null;
    const ipEnd = ipEndStr ? dateOnlyToUtcDate(ipEndStr) : null;
    if (!ipStart || !ipEnd) return true; // conservador
    return rangesOverlap(ipStart, ipEnd, cStart, cEnd);
  }).length;
  return overlapping >= 2;
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
  const [showSecretariatMessage, setShowSecretariatMessage] = useState(false);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [enrolledClassGroupIds, setEnrolledClassGroupIds] = useState<string[]>([]);
  /** Cursos em que o aluno tem turma com status EM_ANDAMENTO (limite de 2 para novas inscrições). */
  const [enrolledCourseIdsEmAndamento, setEnrolledCourseIdsEmAndamento] = useState<string[]>([]);
  const [classGroupsEmAndamento, setClassGroupsEmAndamento] = useState<
    { courseId: string; startDate: string; endDate?: string | null }[]
  >([]);
  const [enrollmentSuccessName, setEnrollmentSuccessName] = useState<string | null>(null);

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
        enrolledCourseIdsEmAndamento?: string[];
        classGroupsEmAndamento?: { courseId: string; startDate: string; endDate?: string | null }[];
      }>;
      const cgJson = (await cgRes.json()) as ApiResponse<{ classGroups: ClassGroupOption[] }>;
      if (meJson?.ok) {
        setStudent(meJson.data.student ?? null);
        setEnrolledCourseIds(meJson.data.enrolledCourseIds ?? []);
        setEnrolledClassGroupIds(meJson.data.enrolledClassGroupIds ?? []);
        setEnrolledCourseIdsEmAndamento(meJson.data.enrolledCourseIdsEmAndamento ?? []);
        setClassGroupsEmAndamento(meJson.data.classGroupsEmAndamento ?? []);
      }
      if (cgJson?.ok && cgJson.data.classGroups) {
        // API retorna só PLANEJADA com vagas; mantém filtro defensivo.
        setClassGroups(cgJson.data.classGroups.filter((cg) => cg.status === "PLANEJADA"));
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

  const selectedClassGroups = classGroups.filter((c) => selectedClassGroupIds.includes(c.id));
  const showLimitBanner =
    classGroupsEmAndamento.length >= 2 && classGroups.some((cg) => overlapsWithTwoInProgress(cg, classGroupsEmAndamento));

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
   * Bloqueia turmas de cursos em que o usuário já está matriculado (uma turma por curso).
   * Limite “2 cursos” na inscrição pública aplica-se apenas a turmas em andamento (ver API + banner na página).
   */
  function isClassGroupOptionDisabled(cg: ClassGroupOption): boolean {
    if (selectedClassGroupIds.includes(cg.id)) return false;
    if (enrolledClassGroupIds.includes(cg.id)) return true;
    if (enrolledCourseIds.includes(cg.courseId)) {
      // Exceção: pode se inscrever novamente no mesmo curso se a turma nova começar só depois do término
      // da(s) turma(s) em andamento desse curso.
      const canReEnrollSameCourse = canEnrollSameCourseAfterInProgressEnds({
        courseId: cg.courseId,
        candidateStartDate: cg.startDate,
        inProgress: classGroupsEmAndamento,
      });
      if (!canReEnrollSameCourse) return true;
    }
    // Regra: não permitir inscrição em turma cujo período sobreponha o período de 2 turmas EM_ANDAMENTO do aluno.
    if (classGroupsEmAndamento.length >= 2) {
      const cgStartStr = toDateOnlyString(cg.startDate);
      const cgEndStr = toDateOnlyString(cg.endDate ?? cg.startDate);
      const cgStart = cgStartStr ? dateOnlyToUtcDate(cgStartStr) : null;
      const cgEnd = cgEndStr ? dateOnlyToUtcDate(cgEndStr) : null;
      if (cgStart && cgEnd) {
        const overlapping = classGroupsEmAndamento.filter((ip) => {
          const ipStartStr = toDateOnlyString(ip.startDate);
          const ipEndStr = toDateOnlyString(ip.endDate ?? ip.startDate);
          const ipStart = ipStartStr ? dateOnlyToUtcDate(ipStartStr) : null;
          const ipEnd = ipEndStr ? dateOnlyToUtcDate(ipEndStr) : null;
          if (!ipStart || !ipEnd) return true; // conservador: se não souber, considera sobreposição
          return rangesOverlap(ipStart, ipEnd, cgStart, cgEnd);
        }).length;
        if (overlapping >= 2) return true;
      } else {
        // Se não conseguir interpretar datas, mantém o bloqueio conservador.
        return true;
      }
    }
    if (selectedClassGroupIds.length >= 2) return true;
    const selected = classGroups.filter((c) => selectedClassGroupIds.includes(c.id));
    if (selected.some((other) => doOverlap(other, cg))) return true;
    return false;
  }

  /** Aplica as regras de seleção (limite e sobreposição) e alterna a turma escolhida. */
  function toggleClassGroup(cg: ClassGroupOption) {
    if (isClassGroupOptionDisabled(cg)) return;
    const selected = selectedClassGroupIds.includes(cg.id);
    const newIds = selected
      ? selectedClassGroupIds.filter((id) => id !== cg.id)
      : [...selectedClassGroupIds, cg.id];
    if (newIds.length > 2) {
      toast.push("error", "Você pode selecionar no máximo 2 turmas.");
      return;
    }
    const newSelected = newIds
      .map((id) => classGroups.find((c) => c.id === id))
      .filter(Boolean) as ClassGroupOption[];
    for (let i = 0; i < newSelected.length; i++) {
      for (let j = i + 1; j < newSelected.length; j++) {
        if (doOverlap(newSelected[i], newSelected[j])) {
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
      let successCount = 0;
      for (const classGroupId of selectedClassGroupIds) {
        const body: { classGroupId: string; studentToken?: string } = { classGroupId };
        if (studentToken) body.studentToken = studentToken;
        const res = await fetch("/api/public/enrollments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as ApiResponse<{ enrollment: { courseName: string } }>;
        if (res.ok && json?.ok) {
          successCount++;
        } else {
          toast.push("error", json && "error" in json ? json.error.message : "Erro ao enviar pré-matrícula.");
        }
      }
      if (successCount > 0) {
        if (registeredWithoutEmail) {
          setShowSecretariatMessage(true);
        } else {
          setEnrollmentSuccessName(student.name);
          const newCourseIds = selectedClassGroups.map((c) => c.courseId);
          setEnrolledCourseIds((prev) => [...new Set([...prev, ...newCourseIds])]);
          setEnrolledClassGroupIds((prev) => [...new Set([...prev, ...selectedClassGroupIds])]);
        }
      }
      setSelectedClassGroupIds([]);
      if (successCount === 0) {
        setStudentToken(null);
        setRegisteredWithoutEmail(false);
        void load({ ignoreCourseId: true });
      }
    } finally {
      setSubmitting(false);
    }
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

  if (showSecretariatMessage) {
    return (
      <div className="space-y-6">
        <div
          className={`${cardClass} border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/40`}
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
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Pré-matrícula enviada</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                Como você não informou e-mail, será necessário comparecer à secretaria para completar seu cadastro e entregar os documentos (documento de identidade e comprovante de residência), para que sua matrícula seja confirmada.
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Anote o CPF utilizado na inscrição para facilitar o atendimento.
              </p>
              <div className="mt-6">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={() => setShowSecretariatMessage(false)}
                >
                  Fazer nova inscrição em outra turma
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
      {enrollmentSuccessName && (
        <div
          className={`${cardClass} flex gap-4 border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/40`}
          role="status"
          aria-live="polite"
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
            aria-hidden
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Inscrição confirmada</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Sua pré-matrícula foi registrada. Aguarde a confirmação pela equipe quando for o caso.
            </p>
          </div>
        </div>
      )}

      {showLimitBanner ? (
        <div className={`${cardClass} border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/40`}>
          <p className="font-semibold text-[var(--text-primary)]">Limite de cursos atingido</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Você já está inscrito em 2 cursos com turmas em andamento. Para se inscrever em outro curso, entre em contato com a secretaria ou aguarde o encerramento de alguma turma.
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
                  aria-label={`Cursos em andamento: ${enrolledCourseIdsEmAndamento.length} de 2`}
                >
                  Em andamento: {enrolledCourseIdsEmAndamento.length}/2
                </span>
              ) : null}
            </div>
            <p className={hintClass}>
              Selecione até 2 turmas por envio, sem sobreposição de dia e horário. O limite de 2 cursos vale para turmas em andamento.
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
                  setEnrollmentSuccessName(null);
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

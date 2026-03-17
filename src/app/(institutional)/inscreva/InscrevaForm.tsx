"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site";
import type { ApiResponse } from "@/lib/api-types";

type StudentData = {
  id: string;
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  email: string | null;
};

type ClassGroupOption = {
  id: string;
  courseId: string;
  courseName: string;
  startDate: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  location: string | null;
  status: string;
};

function formatCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/** Formata uma data (YYYY-MM-DD ou ISO completo) para pt-BR sem mudança de fuso. */
function formatDateOnlyBR(isoDate: string): string {
  const datePart = isoDate.trim().split("T")[0] ?? isoDate.trim();
  const parts = datePart.split("-").map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return isoDate;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

function formatDateForInput(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Primeira letra de cada palavra maiúscula, restante minúscula. */
function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => (word.length === 0 ? "" : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

/** Converte "HH:MM" ou "HH:MM:SS" em minutos desde meia-noite. */
function timeToMinutes(t: string): number {
  const parts = (t || "0:0").split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/** Verifica se duas turmas têm dia e horário sobrepostos. */
function doOverlap(a: ClassGroupOption, b: ClassGroupOption): boolean {
  const daysA = new Set(Array.isArray(a.daysOfWeek) ? a.daysOfWeek : []);
  const daysB = new Set(Array.isArray(b.daysOfWeek) ? b.daysOfWeek : []);
  const shared = [...daysA].filter((d) => daysB.has(d));
  if (shared.length === 0) return false;
  const startA = timeToMinutes(a.startTime);
  const endA = timeToMinutes(a.endTime);
  const startB = timeToMinutes(b.startTime);
  const endB = timeToMinutes(b.endTime);
  return startA < endB && endA > startB;
}

/** Calcula idade a partir da data de nascimento (string YYYY-MM-DD). */
function ageFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
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
  const [cadastroName, setCadastroName] = useState("");
  const [cadastroCpf, setCadastroCpf] = useState("");
  const [cadastroBirthDate, setCadastroBirthDate] = useState("");
  const [cadastroPhone, setCadastroPhone] = useState("");
  const [cadastroEmail, setCadastroEmail] = useState("");
  const [cadastroEmailConfirm, setCadastroEmailConfirm] = useState("");
  const [cadastroGuardianCpf, setCadastroGuardianCpf] = useState("");
  const [cadastroSubmitting, setCadastroSubmitting] = useState(false);
  const [registeredWithoutEmail, setRegisteredWithoutEmail] = useState(false);
  const [showSecretariatMessage, setShowSecretariatMessage] = useState(false);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
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
      const meJson = (await meRes.json()) as ApiResponse<{ student: StudentData | null; enrolledCourseIds?: string[] }>;
      const cgJson = (await cgRes.json()) as ApiResponse<{ classGroups: ClassGroupOption[] }>;
      if (meJson?.ok) {
        setStudent(meJson.data.student ?? null);
        setEnrolledCourseIds(meJson.data.enrolledCourseIds ?? []);
      }
      if (cgJson?.ok && cgJson.data.classGroups) {
        // Exibir apenas turmas ABERTA na página de inscrição (não EM_ANDAMENTO, INTERNO, etc.)
        setClassGroups(cgJson.data.classGroups.filter((cg) => cg.status === "ABERTA"));
      }
    } finally {
      setLoading(false);
    }
  }, [courseIdFromUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const cadastroAge = ageFromBirthDate(cadastroBirthDate);
  const isMinor = cadastroAge != null && cadastroAge < 18;

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    if (cadastroSubmitting) return;
    const name = cadastroName.trim();
    const cpf = cadastroCpf.replace(/\D/g, "");
    const phone = cadastroPhone.replace(/\D/g, "");
    const email = cadastroEmail.trim().toLowerCase() || undefined;
    const emailConfirm = cadastroEmailConfirm.trim().toLowerCase();
    const guardianCpf = cadastroGuardianCpf.replace(/\D/g, "");
    const cpfOk = isMinor ? true : cpf.length === 11;
    if (!name || !cpfOk || !cadastroBirthDate || phone.length < 10) {
      toast.push("error", "Preencha todos os campos obrigatórios.");
      return;
    }
    if (email && email !== emailConfirm) {
      toast.push("error", "Os e-mails digitados não coincidem. Confira e tente novamente.");
      return;
    }
    if (isMinor && guardianCpf.length !== 11) {
      toast.push("error", "Para menores de 18 anos é obrigatório informar o CPF do responsável.");
      return;
    }
    setCadastroSubmitting(true);
    try {
      const res = await fetch("/api/public/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...(cpf.length === 11 ? { cpf } : {}),
          birthDate: cadastroBirthDate,
          phone,
          ...(email ? { email } : {}),
          ...(isMinor && guardianCpf ? { guardianCpf: cadastroGuardianCpf } : {}),
        }),
      });
      const json = (await res.json()) as ApiResponse<{ student: StudentData; studentToken: string }>;
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok && "error" in json ? json.error.message : "Erro ao cadastrar.");
        return;
      }
      setStudent(json.data.student);
      setStudentToken(json.data.studentToken);
      setRegisteredWithoutEmail(!json.data.student.email);
      setShowCadastro(false);
      if (json.data.student.email) {
        toast.push("success", "Cadastro realizado! Verifique seu e-mail para acessar a área do aluno. Agora escolha a turma abaixo.");
      } else {
        toast.push("success", "Cadastro realizado! Escolha a turma abaixo e finalize sua pré-matrícula.");
      }
    } finally {
      setCadastroSubmitting(false);
    }
  }

  const selectedClassGroups = classGroups.filter((c) => selectedClassGroupIds.includes(c.id));
  /** Conjunto de courseIds já em uso: matrículas atuais + cursos das turmas selecionadas. */
  const selectedCourseIds = new Set<string>([
    ...enrolledCourseIds,
    ...selectedClassGroups.map((c) => c.courseId),
  ]);
  const totalCoursesNow = selectedCourseIds.size;

  /**
   * Bloqueia turmas de cursos em que o usuário já está matriculado (uma turma por curso).
   * Quando Cursos: 2/2, bloqueia todas as opções exceto as já selecionadas.
   * Caso contrário: desabilita se já tem 2 turmas, sobreposição de horário ou passaria de 2 cursos.
   */
  function isClassGroupOptionDisabled(cg: ClassGroupOption): boolean {
    if (selectedClassGroupIds.includes(cg.id)) return false;
    if (enrolledCourseIds.includes(cg.courseId)) return true;
    if (totalCoursesNow >= 2) return true;
    if (selectedClassGroupIds.length >= 2) return true;
    const selected = classGroups.filter((c) => selectedClassGroupIds.includes(c.id));
    if (selected.some((other) => doOverlap(other, cg))) return true;
    const courseIdsIfWeAdd = new Set([...selectedCourseIds, cg.courseId]);
    return courseIdsIfWeAdd.size > 2;
  }

  async function handleEnrollment(e: React.FormEvent) {
    e.preventDefault();
    if (!student || selectedClassGroupIds.length === 0 || submitting) return;
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
          const newEnrolledIds = [...new Set([...enrolledCourseIds, ...selectedClassGroups.map((c) => c.courseId)])];
          setEnrolledCourseIds(newEnrolledIds);
        }
        setCadastroName("");
        setCadastroCpf("");
        setCadastroBirthDate("");
        setCadastroPhone("");
        setCadastroEmail("");
        setCadastroEmailConfirm("");
        setCadastroGuardianCpf("");
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

  const cardClass =
    "rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm sm:p-8";
  const labelClass = "block text-sm font-semibold text-[var(--text-primary)]";
  const hintClass = "mt-1 text-xs text-[var(--text-muted)]";
  const inputClass =
    "mt-1.5 min-h-[44px] w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)]/20 sm:min-h-[42px]";

  if (loading) {
    return (
      <div className={cardClass}>
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--igh-primary)] border-t-transparent"
            aria-hidden
          />
          <p className="text-sm text-[var(--text-muted)]">Carregando suas informações...</p>
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

  if (!student) {
    return (
      <div className="space-y-6">
        <div className={cardClass}>
          <h2 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Identifique-se</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Para fazer sua pré-matrícula, faça login se já tem cadastro ou cadastre-se com seus dados.
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
              onClick={() => setShowCadastro(true)}
            >
              Cadastrar-se
            </Button>
          </div>
        </div>

        {showCadastro && (
          <div className={cardClass} role="region" aria-labelledby="cadastro-title">
            <h2 id="cadastro-title" className="text-xl font-bold text-[var(--text-primary)]">
              Cadastro rápido
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              Preencha os campos obrigatórios. E-mail é opcional; sem ele você precisará ir à secretaria para entregar documentos. Com e-mail, você acessa a área do aluno.
            </p>
            <form onSubmit={handleCadastro} className="mt-8 space-y-6">
              <fieldset className="space-y-4">
                <legend className="sr-only">Dados pessoais</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="cadastro-name" className={labelClass}>Nome *</label>
                    <input
                      id="cadastro-name"
                      className={inputClass}
                      value={cadastroName}
                      onChange={(e) => setCadastroName(toTitleCase(e.target.value))}
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label htmlFor="cadastro-birth" className={labelClass}>Data de nascimento *</label>
                    <input
                      id="cadastro-birth"
                      className={inputClass}
                      type="date"
                      value={cadastroBirthDate}
                      onChange={(e) => setCadastroBirthDate(e.target.value)}
                      required
                    />
                    {cadastroBirthDate && cadastroAge != null && (
                      <p className={hintClass}>
                        {cadastroAge} anos{cadastroAge < 18 ? " — informe o CPF do responsável abaixo" : ""}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="cadastro-cpf" className={labelClass}>
                      {isMinor ? "CPF do aluno (opcional)" : "CPF *"}
                    </label>
                    <input
                      id="cadastro-cpf"
                      className={inputClass}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={cadastroCpf}
                      onChange={(e) => setCadastroCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      required={!isMinor}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-[var(--text-primary)]">Contato</legend>
                <div>
                  <label htmlFor="cadastro-email" className={labelClass}>E-mail (opcional)</label>
                  <input
                    id="cadastro-email"
                    className={inputClass}
                    type="email"
                    value={cadastroEmail}
                    onChange={(e) => setCadastroEmail(e.target.value.toLowerCase())}
                    placeholder="seu@email.com"
                    autoComplete="email"
                  />
                  {cadastroEmail.trim().length > 0 && (
                    <div className="mt-4">
                      <label htmlFor="cadastro-email-confirm" className={labelClass}>Confirme seu e-mail</label>
                      <input
                        id="cadastro-email-confirm"
                        className={inputClass}
                        type="email"
                        value={cadastroEmailConfirm}
                        onChange={(e) => setCadastroEmailConfirm(e.target.value.toLowerCase())}
                        placeholder="repita o e-mail"
                        autoComplete="email"
                      />
                    </div>
                  )}
                  <p className={hintClass}>
                    Sem e-mail: será preciso ir à secretaria para entregar documento de identidade e comprovante de residência.
                  </p>
                </div>
                <div>
                  <label htmlFor="cadastro-phone" className={labelClass}>Telefone *</label>
                  <input
                    id="cadastro-phone"
                    className={inputClass}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={cadastroPhone}
                    onChange={(e) => setCadastroPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    required
                  />
                </div>
              </fieldset>

              {isMinor && (
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-[var(--text-primary)]">Responsável (menor de 18 anos)</legend>
                  <div>
                    <label htmlFor="cadastro-guardian-cpf" className={labelClass}>CPF do responsável *</label>
                    <input
                      id="cadastro-guardian-cpf"
                      className={inputClass}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={cadastroGuardianCpf}
                      onChange={(e) => setCadastroGuardianCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      required
                    />
                  </div>
                </fieldset>
              )}

              <div className="flex flex-col gap-3 border-t border-[var(--card-border)] pt-6 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCadastro(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={cadastroSubmitting}>
                  {cadastroSubmitting ? "Cadastrando..." : "Cadastrar e continuar"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

      <div className={cardClass}>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Seus dados</h2>
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
          <Button as="link" href="/minhas-turmas" variant="primary" size="lg">
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
                void load();
              }}
              className="font-semibold text-[var(--igh-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2 rounded"
            >
              Sair e fazer login com outra conta
            </button>
          </span>
        </div>
      </div>

      <div className={cardClass}>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Escolher turmas</h2>
        {enrolledCourseIds.length >= 2 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="font-semibold text-[var(--text-primary)]">Limite de cursos atingido</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              Você já está inscrito em 2 cursos. Para se inscrever em outra turma, entre em contato com a secretaria ou aguarde o encerramento de alguma turma.
            </p>
          </div>
        ) : (
          <form onSubmit={handleEnrollment} className="mt-6 space-y-6">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Selecione até 2 turmas (máximo 2 cursos no total; turmas no mesmo dia e horário não podem ser escolhidas juntas)
                </p>
                <span
                  className="rounded-full bg-[var(--igh-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)]"
                  aria-label={`Cursos no total: ${totalCoursesNow} de 2`}
                >
                  Cursos: {totalCoursesNow}/2
                </span>
              </div>
              <p className={hintClass}>
                {enrolledCourseIds.length >= 2
                  ? "Você já está no limite de 2 cursos. Não é possível adicionar turmas de outro curso."
                  : enrolledCourseIds.length === 1
                    ? "Você já está em 1 curso. Pode adicionar turmas apenas do mesmo curso ou de mais 1 curso (máx. 2 no total)."
                    : "Toque nas turmas desejadas. Máximo 2 cursos no total."}
              </p>
              {classGroups.length === 0 ? (
                <div className="mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-8 text-center">
                  <p className="text-sm text-[var(--text-muted)]">Nenhuma turma disponível no momento.</p>
                </div>
              ) : (
                <div
                  className="mt-4 max-h-[320px] space-y-2 overflow-y-auto rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3"
                  role="listbox"
                  aria-label="Escolha até 2 turmas"
                  aria-multiselectable="true"
                >
                  {classGroups.map((cg) => {
                    const disabled = isClassGroupOptionDisabled(cg);
                    const selected = selectedClassGroupIds.includes(cg.id);
                    const daysStr = Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? cg.daysOfWeek.join(", ") : null;
                    return (
                      <button
                        key={cg.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          const newIds = selected
                            ? selectedClassGroupIds.filter((id) => id !== cg.id)
                            : [...selectedClassGroupIds, cg.id];
                          if (newIds.length > 2) {
                            toast.push("error", "Você pode selecionar no máximo 2 turmas.");
                            return;
                          }
                          const newSelected = newIds.map((id) => classGroups.find((c) => c.id === id)).filter(Boolean) as ClassGroupOption[];
                          const coursesUsed = new Set([...enrolledCourseIds, ...newSelected.map((c) => c.courseId)]);
                          if (coursesUsed.size > 2) {
                            toast.push("error", "O limite é de 2 cursos no total (você já está em " + enrolledCourseIds.length + "). Escolha turmas de no máximo mais " + (2 - enrolledCourseIds.length) + " curso(s).");
                            return;
                          }
                          for (let i = 0; i < newSelected.length; i++) {
                            for (let j = i + 1; j < newSelected.length; j++) {
                              if (doOverlap(newSelected[i], newSelected[j])) {
                                toast.push("error", "Turmas no mesmo dia e horário não podem ser selecionadas juntas.");
                                return;
                              }
                            }
                          }
                          setSelectedClassGroupIds(newIds);
                        }}
                        className={`flex w-full cursor-pointer flex-col rounded-xl border-2 px-4 py-3.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected
                            ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10 text-[var(--text-primary)]"
                            : disabled
                              ? "border-[var(--card-border)] text-[var(--text-muted)]"
                              : "border-transparent bg-[var(--card-bg)] text-[var(--text-primary)] hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5"
                        }`}
                      >
                        <span className="font-semibold">{cg.courseName}</span>
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">
                          Início {formatDateOnlyBR(cg.startDate)} · {cg.startTime}–{cg.endTime}
                          {daysStr ? ` · ${daysStr}` : ""}
                          {cg.location?.trim() ? ` · ${cg.location.trim()}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {courseIdFromUrl && classGroups.length > 0 && (
                <p className="mt-3">
                  <a
                    href="/inscreva"
                    className="text-sm font-medium text-[var(--igh-primary)] hover:underline"
                  >
                    Ver todos os cursos
                  </a>
                </p>
              )}
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={
                submitting ||
                selectedClassGroupIds.length === 0 ||
                classGroups.length === 0 ||
                totalCoursesNow > 2
              }
              className="w-full sm:w-auto"
            >
              {submitting ? "Enviando..." : "Enviar pré-matrícula"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

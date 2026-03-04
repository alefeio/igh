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

function formatDateForInput(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [cadastroSubmitting, setCadastroSubmitting] = useState(false);
  const [registeredWithoutEmail, setRegisteredWithoutEmail] = useState(false);
  const [showSecretariatMessage, setShowSecretariatMessage] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cgUrl = courseIdFromUrl
        ? `/api/public/class-groups?courseId=${encodeURIComponent(courseIdFromUrl)}`
        : "/api/public/class-groups";
      const [meRes, cgRes] = await Promise.all([
        fetch("/api/me/student"),
        fetch(cgUrl),
      ]);
      const meJson = (await meRes.json()) as ApiResponse<{ student: StudentData | null }>;
      const cgJson = (await cgRes.json()) as ApiResponse<{ classGroups: ClassGroupOption[] }>;
      if (meJson?.ok) setStudent(meJson.data.student ?? null);
      if (cgJson?.ok && cgJson.data.classGroups) setClassGroups(cgJson.data.classGroups);
    } finally {
      setLoading(false);
    }
  }, [courseIdFromUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    if (cadastroSubmitting) return;
    const name = cadastroName.trim();
    const cpf = cadastroCpf.replace(/\D/g, "");
    const phone = cadastroPhone.replace(/\D/g, "");
    const email = cadastroEmail.trim().toLowerCase() || undefined;
    if (!name || cpf.length !== 11 || !cadastroBirthDate || phone.length < 10) {
      toast.push("error", "Preencha todos os campos obrigatórios.");
      return;
    }
    setCadastroSubmitting(true);
    try {
      const res = await fetch("/api/public/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          cpf,
          birthDate: cadastroBirthDate,
          phone,
          ...(email ? { email } : {}),
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

  function toggleClassGroup(id: string) {
    const cg = classGroups.find((c) => c.id === id);
    if (!cg) return;
    const isSelected = selectedClassGroupIds.includes(id);
    if (isSelected) {
      setSelectedClassGroupIds((prev) => prev.filter((x) => x !== id));
      return;
    }
    if (selectedClassGroupIds.length >= 2) {
      toast.push("error", "Você pode selecionar no máximo 2 turmas.");
      return;
    }
    const selected = classGroups.filter((c) => selectedClassGroupIds.includes(c.id));
    if (selected.some((other) => doOverlap(other, cg))) {
      toast.push("error", "Esta turma tem horário no mesmo dia e hora de outra já selecionada. Escolha turmas em dias ou horários diferentes.");
      return;
    }
    setSelectedClassGroupIds((prev) => [...prev, id]);
  }

  function isCheckboxDisabled(cg: ClassGroupOption): boolean {
    if (selectedClassGroupIds.includes(cg.id)) return false;
    if (selectedClassGroupIds.length >= 2) return true;
    const selected = classGroups.filter((c) => selectedClassGroupIds.includes(c.id));
    return selected.some((other) => doOverlap(other, cg));
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
          toast.push("success", successCount === 1 ? "Pré-matrícula enviada. Aguarde a confirmação pela equipe." : `${successCount} pré-matrículas enviadas. Aguarde a confirmação pela equipe.`);
        }
      }
      setSelectedClassGroupIds([]);
      setStudentToken(null);
      setRegisteredWithoutEmail(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }

  const cardClass = "rounded-xl border border-[var(--card-border)] p-6 shadow-sm theme-bg-card";
  const labelClass = "text-sm font-medium theme-text-label";
  const hintClass = "text-xs theme-text-muted";
  const inputClass = "min-h-[44px] w-full rounded-md border border-[var(--input-border)] px-3 text-sm theme-input sm:h-10 sm:min-h-0";

  if (loading) {
    return (
      <div className={`${cardClass} text-center theme-text-muted`}>
        Carregando...
      </div>
    );
  }

  if (showSecretariatMessage) {
    return (
      <div className="space-y-6">
        <div className={`${cardClass} border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30`}>
          <h3 className="text-lg font-semibold theme-text-label">Pré-matrícula enviada</h3>
          <p className="mt-3 text-sm theme-text-label">
            Como você não informou e-mail, será necessário comparecer à secretaria para completar seu cadastro e entregar os documentos (documento de identidade e comprovante de residência), para que sua matrícula seja confirmada.
          </p>
          <p className="mt-2 text-sm theme-text-muted">
            Anote o número do CPF utilizado na inscrição para facilitar o atendimento.
          </p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <div className={cardClass}>
          <h3 className="text-lg font-semibold theme-text-label">Identifique-se</h3>
          <p className="mt-2 text-sm theme-text-muted">
            Para fazer sua pré-matrícula, faça login se você já tem cadastro ou cadastre-se com seus dados.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button as="link" href="/login?from=/inscreva" variant="primary" className="flex-1">
              Fazer login
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowCadastro(true)}
            >
              Cadastrar-se
            </Button>
          </div>
        </div>

        {showCadastro && (
          <div className={cardClass}>
            <h3 className="text-lg font-semibold theme-text-label">Cadastro rápido</h3>
            <p className="mt-1 text-sm theme-text-muted">
              Preencha os campos obrigatórios. O e-mail é opcional; sem ele, você precisará ir à secretaria para concluir o cadastro.
            </p>
            <form onSubmit={handleCadastro} className="mt-4 flex flex-col gap-4">
              <div>
                <label className={labelClass}>Nome *</label>
                <input
                  className={`mt-1 ${inputClass}`}
                  value={cadastroName}
                  onChange={(e) => setCadastroName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>E-mail (opcional)</label>
                <input
                  className={`mt-1 ${inputClass}`}
                  type="email"
                  value={cadastroEmail}
                  onChange={(e) => setCadastroEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
                <p className={hintClass}>Se informar, você receberá a confirmação por e-mail. Use sua data de nascimento para o primeiro acesso.</p>
              </div>
              <div>
                <label className={labelClass}>CPF *</label>
                <input
                  className={`mt-1 ${inputClass}`}
                  value={cadastroCpf}
                  onChange={(e) => setCadastroCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Data de nascimento *</label>
                <input
                  className={`mt-1 ${inputClass}`}
                  type="date"
                  value={cadastroBirthDate}
                  onChange={(e) => setCadastroBirthDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Telefone *</label>
                <input
                  className={`mt-1 ${inputClass}`}
                  value={cadastroPhone}
                  onChange={(e) => setCadastroPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  required
                />
              </div>
              <div className="flex gap-2">
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
    <div className="space-y-6">
      <div className={cardClass}>
        <h3 className="text-lg font-semibold theme-text-label">Seus dados</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className={hintClass}>Nome</dt>
            <dd className="font-medium" style={{ color: "var(--text-primary)" }}>{student.name}</dd>
          </div>
          <div>
            <dt className={hintClass}>CPF</dt>
            <dd className="font-medium" style={{ color: "var(--text-primary)" }}>{student.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</dd>
          </div>
          <div>
            <dt className={hintClass}>Nascimento</dt>
            <dd className="font-medium" style={{ color: "var(--text-primary)" }}>
              {student.birthDate ? formatDateForInput(student.birthDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className={hintClass}>Telefone</dt>
            <dd className="font-medium" style={{ color: "var(--text-primary)" }}>{student.phone}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs theme-text-muted">
          Não é você?{" "}
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              setStudent(null);
              setStudentToken(null);
              setSelectedClassGroupIds([]);
              void load();
            }}
            className="font-medium hover:underline"
            style={{ color: "var(--igh-primary)" }}
          >
            Faça login
          </button>{" "}
          com outra conta.
        </p>
      </div>

      <div className={cardClass}>
        <form onSubmit={handleEnrollment} className="flex flex-col gap-4">
          <div>
            <p className={labelClass}>
              Escolha até 2 turmas (não podem ser no mesmo dia e horário) *
            </p>
            <p className={`mt-1 ${hintClass}`}>
              Marque as turmas desejadas. Turmas no mesmo dia e horário não podem ser selecionadas juntas.
            </p>
            {classGroups.length === 0 ? (
              <p className={`mt-3 ${hintClass}`}>Nenhuma turma disponível no momento.</p>
            ) : (
              <ul className="mt-3 space-y-2 list-none pl-0">
                {classGroups.map((cg) => {
                  const checked = selectedClassGroupIds.includes(cg.id);
                  const disabled = isCheckboxDisabled(cg);
                  return (
                    <li key={cg.id} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id={`cg-${cg.id}`}
                        checked={checked}
                        onChange={() => toggleClassGroup(cg.id)}
                        disabled={disabled}
                        className="mt-1 h-4 w-4 rounded border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--igh-primary)] focus:ring-[var(--igh-primary)]"
                      />
                      <label
                        htmlFor={`cg-${cg.id}`}
                        className={`text-sm cursor-pointer ${disabled && !checked ? "theme-text-muted" : ""}`}
                        style={!(disabled && !checked) ? { color: "var(--text-primary)" } : undefined}
                      >
                        <span className="font-medium">{cg.courseName}</span>
                        {" — "}
                        Início {formatDateForInput(cg.startDate)} — {cg.startTime}–{cg.endTime}
                        {Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? ` — ${cg.daysOfWeek.join(", ")}` : ""}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {courseIdFromUrl && (
              <p className="mt-2">
                <a
                  href="/inscreva"
                  className={`text-xs ${hintClass} hover:underline`}
                >
                  Ver outros cursos
                </a>
              </p>
            )}
          </div>
          <Button type="submit" disabled={submitting || selectedClassGroupIds.length === 0 || classGroups.length === 0}>
            {submitting ? "Enviando..." : "Enviar pré-matrícula"}
          </Button>
        </form>
      </div>
    </div>
  );
}

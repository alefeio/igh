"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button, Card } from "@/components/site";
import { Input } from "@/components/ui/Input";
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

export function InscrevaForm() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentData | null>(null);
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [classGroups, setClassGroups] = useState<ClassGroupOption[]>([]);
  const [classGroupId, setClassGroupId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);
  const [cadastroName, setCadastroName] = useState("");
  const [cadastroCpf, setCadastroCpf] = useState("");
  const [cadastroBirthDate, setCadastroBirthDate] = useState("");
  const [cadastroPhone, setCadastroPhone] = useState("");
  const [cadastroEmail, setCadastroEmail] = useState("");
  const [cadastroSubmitting, setCadastroSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, cgRes] = await Promise.all([
        fetch("/api/me/student"),
        fetch("/api/public/class-groups"),
      ]);
      const meJson = (await meRes.json()) as ApiResponse<{ student: StudentData | null }>;
      const cgJson = (await cgRes.json()) as ApiResponse<{ classGroups: ClassGroupOption[] }>;
      if (meJson?.ok) setStudent(meJson.data.student ?? null);
      if (cgJson?.ok && cgJson.data.classGroups) setClassGroups(cgJson.data.classGroups);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    if (cadastroSubmitting) return;
    const name = cadastroName.trim();
    const cpf = cadastroCpf.replace(/\D/g, "");
    const phone = cadastroPhone.replace(/\D/g, "");
    const email = cadastroEmail.trim().toLowerCase();
    if (!name || cpf.length !== 11 || !cadastroBirthDate || phone.length < 10 || !email) {
      toast.push("error", "Preencha todos os campos corretamente.");
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
          email,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ student: StudentData; studentToken: string }>;
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok && "error" in json ? json.error.message : "Erro ao cadastrar.");
        return;
      }
      setStudent(json.data.student);
      setStudentToken(json.data.studentToken);
      setShowCadastro(false);
      toast.push("success", "Cadastro realizado! Verifique seu e-mail para acessar a área do aluno. Agora escolha a turma abaixo.");
    } finally {
      setCadastroSubmitting(false);
    }
  }

  async function handleEnrollment(e: React.FormEvent) {
    e.preventDefault();
    if (!student || !classGroupId || submitting) return;
    setSubmitting(true);
    try {
      const body: { classGroupId: string; studentToken?: string } = { classGroupId };
      if (studentToken) body.studentToken = studentToken;
      const res = await fetch("/api/public/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<{ enrollment: { courseName: string } }>;
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok && "error" in json ? json.error.message : "Erro ao enviar pré-matrícula.");
        return;
      }
      toast.push("success", `Pré-matrícula enviada para ${json.data.enrollment.courseName}. Aguarde a confirmação pela equipe.`);
      setClassGroupId("");
      setStudentToken(null);
      void load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6 text-center text-[var(--igh-muted)]">
        Carregando...
      </Card>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">Identifique-se</h3>
          <p className="mt-2 text-sm text-[var(--igh-muted)]">
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
        </Card>

        {showCadastro && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">Cadastro rápido</h3>
            <p className="mt-1 text-sm text-[var(--igh-muted)]">
              Preencha apenas os campos obrigatórios. Depois escolha a turma na próxima etapa.
            </p>
            <form onSubmit={handleCadastro} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  className="mt-1"
                  value={cadastroName}
                  onChange={(e) => setCadastroName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">E-mail *</label>
                <Input
                  className="mt-1"
                  type="email"
                  value={cadastroEmail}
                  onChange={(e) => setCadastroEmail(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-[var(--igh-muted)]">Você receberá a senha de acesso por e-mail.</p>
              </div>
              <div>
                <label className="text-sm font-medium">CPF *</label>
                <Input
                  className="mt-1"
                  value={cadastroCpf}
                  onChange={(e) => setCadastroCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data de nascimento *</label>
                <Input
                  className="mt-1"
                  type="date"
                  value={cadastroBirthDate}
                  onChange={(e) => setCadastroBirthDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone *</label>
                <Input
                  className="mt-1"
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
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">Seus dados</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--igh-muted)]">Nome</dt>
            <dd className="font-medium">{student.name}</dd>
          </div>
          <div>
            <dt className="text-[var(--igh-muted)]">CPF</dt>
            <dd className="font-medium">{student.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</dd>
          </div>
          <div>
            <dt className="text-[var(--igh-muted)]">Nascimento</dt>
            <dd className="font-medium">
              {student.birthDate ? formatDateForInput(student.birthDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--igh-muted)]">Telefone</dt>
            <dd className="font-medium">{student.phone}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[var(--igh-muted)]">
          Não é você?{" "}
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              setStudent(null);
              setStudentToken(null);
              setClassGroupId("");
              void load();
            }}
            className="text-[var(--igh-primary)] hover:underline font-medium"
          >
            Faça login
          </button>{" "}
          com outra conta.
        </p>
      </Card>

      <Card className="p-6">
        <form onSubmit={handleEnrollment} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium">Turma *</label>
            <select
              value={classGroupId}
              onChange={(e) => setClassGroupId(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Selecione a turma</option>
              {classGroups.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {cg.courseName} — Início {formatDateForInput(cg.startDate)} — {cg.startTime}-{cg.endTime}
                  {Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? ` — ${cg.daysOfWeek.join(", ")}` : ""}
                </option>
              ))}
            </select>
            {classGroups.length === 0 && (
              <p className="mt-1 text-xs text-[var(--igh-muted)]">Nenhuma turma disponível no momento.</p>
            )}
          </div>
          <Button type="submit" disabled={submitting || !classGroupId || classGroups.length === 0}>
            {submitting ? "Enviando..." : "Enviar pré-matrícula"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

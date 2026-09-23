"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site";
import type { ApiResponse } from "@/lib/api-types";
import { formatDaysShortPtBr } from "@/lib/turma-display";
import { cardClass, hintClass, inputClass, labelClass } from "../../inscreva/ui";

type ClassGroupPublic = {
  courseName: string;
  cycleNumber: number;
  cycleYear: number;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  capacity: number;
  seatsRemaining: number;
  acceptingEnrollments: boolean;
  closedReason: string | null;
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

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => (word.length === 0 ? "" : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

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

function formatDateBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

export function TurmaInviteForm({ token }: { token: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [classGroup, setClassGroup] = useState<ClassGroupPublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [guardianCpf, setGuardianCpf] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    courseName: string;
    emailSent: boolean;
    studentHadNoEmail: boolean;
  } | null>(null);

  const age = ageFromBirthDate(birthDate);
  const isMinor = age != null && age < 18;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/public/class-groups/by-invite/${encodeURIComponent(token)}`);
      const json = (await res.json()) as ApiResponse<{ classGroup: ClassGroupPublic }>;
      if (!res.ok || !json?.ok) {
        setClassGroup(null);
        setLoadError(
          json && !json.ok && "error" in json
            ? json.error.message
            : "Link de inscrição inválido.",
        );
        return;
      }
      setClassGroup(json.data.classGroup);
    } catch {
      setLoadError("Não foi possível carregar a turma.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !classGroup?.acceptingEnrollments) return;

    const trimmedName = name.trim();
    const digitsCpf = cpf.replace(/\D/g, "");
    const digitsPhone = phone.replace(/\D/g, "");
    const normalizedEmail = email.trim().toLowerCase() || undefined;
    const normalizedEmailConfirm = emailConfirm.trim().toLowerCase();
    const digitsGuardianCpf = guardianCpf.replace(/\D/g, "");
    const cpfOk = isMinor ? true : digitsCpf.length === 11;

    if (!trimmedName || !cpfOk || !birthDate || digitsPhone.length < 10) {
      toast.push("error", "Preencha todos os campos obrigatórios.");
      return;
    }
    if (normalizedEmail && normalizedEmail !== normalizedEmailConfirm) {
      toast.push("error", "Os e-mails digitados não coincidem.");
      return;
    }
    if (isMinor && digitsGuardianCpf.length !== 11) {
      toast.push("error", "Para menores de 18 anos é obrigatório informar o CPF do responsável.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/public/class-groups/by-invite/${encodeURIComponent(token)}/enroll`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            ...(digitsCpf.length === 11 ? { cpf: digitsCpf } : {}),
            birthDate,
            phone: digitsPhone,
            ...(normalizedEmail ? { email: normalizedEmail } : {}),
            ...(isMinor && digitsGuardianCpf ? { guardianCpf } : {}),
            website,
          }),
        },
      );
      const json = (await res.json()) as ApiResponse<{
        enrollmentId: string;
        courseName: string;
        emailSent: boolean;
        studentHadNoEmail: boolean;
      }>;
      if (!res.ok || !json?.ok) {
        toast.push(
          "error",
          json && !json.ok && "error" in json ? json.error.message : "Erro ao matricular.",
        );
        return;
      }
      setSuccess({
        courseName: json.data.courseName,
        emailSent: json.data.emailSent,
        studentHadNoEmail: json.data.studentHadNoEmail,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={cardClass}>
        <div className="flex flex-col items-center gap-4 py-8">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--igh-primary)] border-t-transparent"
            aria-hidden
          />
          <p className="text-sm text-[var(--text-muted)]">Carregando turma…</p>
        </div>
      </div>
    );
  }

  if (loadError || !classGroup) {
    return (
      <div className={cardClass}>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Inscrição indisponível</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {loadError ?? "Link de inscrição inválido."}
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className={cardClass}>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Matrícula concluída</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          Você foi matriculado(a) em <strong>{success.courseName}</strong>.
          {success.emailSent
            ? " Enviamos um e-mail com as orientações de acesso."
            : success.studentHadNoEmail
              ? " Como não informou e-mail, procure a secretaria para concluir o cadastro de acesso."
              : " Se já tinha cadastro, use o acesso habitual."}
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <h1 className="text-xl font-bold text-[var(--text-primary)]">{classGroup.courseName}</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Ciclo {classGroup.cycleNumber}/{classGroup.cycleYear}
        {" · "}
        {formatDaysShortPtBr(classGroup.daysOfWeek)} {classGroup.startTime}–{classGroup.endTime}
        {" · "}
        Início {formatDateBr(classGroup.startDate)}
        {classGroup.location ? ` · ${classGroup.location}` : ""}
      </p>
      <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
        {classGroup.seatsRemaining} vaga{classGroup.seatsRemaining === 1 ? "" : "s"} restante
        {classGroup.seatsRemaining === 1 ? "" : "s"}
      </p>

      {!classGroup.acceptingEnrollments ? (
        <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          {classGroup.closedReason ?? "Esta turma não está aceitando matrículas."}
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
            Preencha os campos obrigatórios para se matricular nesta turma.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="sr-only" aria-hidden>
              <label htmlFor="turma-website">Website</label>
              <input
                id="turma-website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <fieldset className="space-y-4">
              <legend className="sr-only">Dados pessoais</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="turma-name" className={labelClass}>
                    Nome *
                  </label>
                  <input
                    id="turma-name"
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(toTitleCase(e.target.value))}
                    required
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="turma-birth" className={labelClass}>
                    Data de nascimento *
                  </label>
                  <input
                    id="turma-birth"
                    className={inputClass}
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    required
                  />
                  {birthDate && age != null ? (
                    <p className={hintClass}>
                      {age} anos{age < 18 ? " — informe o CPF do responsável abaixo" : ""}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="turma-cpf" className={labelClass}>
                    {isMinor ? "CPF do aluno (opcional)" : "CPF *"}
                  </label>
                  <input
                    id="turma-cpf"
                    className={inputClass}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
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
                <label htmlFor="turma-phone" className={labelClass}>
                  Telefone *
                </label>
                <input
                  id="turma-phone"
                  className={inputClass}
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(91) 99999-9999"
                  required
                  autoComplete="tel"
                />
              </div>
              <div>
                <label htmlFor="turma-email" className={labelClass}>
                  E-mail (opcional)
                </label>
                <input
                  id="turma-email"
                  className={inputClass}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
                {email.trim().length > 0 ? (
                  <div className="mt-4">
                    <label htmlFor="turma-email-confirm" className={labelClass}>
                      Confirme seu e-mail
                    </label>
                    <input
                      id="turma-email-confirm"
                      className={inputClass}
                      type="email"
                      value={emailConfirm}
                      onChange={(e) => setEmailConfirm(e.target.value.toLowerCase())}
                      placeholder="repita o e-mail"
                      autoComplete="email"
                    />
                  </div>
                ) : null}
              </div>
              {isMinor ? (
                <div>
                  <label htmlFor="turma-guardian-cpf" className={labelClass}>
                    CPF do responsável *
                  </label>
                  <input
                    id="turma-guardian-cpf"
                    className={inputClass}
                    type="text"
                    inputMode="numeric"
                    value={guardianCpf}
                    onChange={(e) => setGuardianCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                  />
                </div>
              ) : null}
            </fieldset>

            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? "Enviando…" : "Matricular-me nesta turma"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

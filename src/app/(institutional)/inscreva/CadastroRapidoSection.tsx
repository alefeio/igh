"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site";
import type { ApiResponse } from "@/lib/api-types";
import { readStoredReferralCode } from "@/lib/referral-client";
import type { StudentData } from "./types";
import { cardClass, hintClass, inputClass, labelClass } from "./ui";

/** Âncora da seção «Cadastro rápido» em /inscreva */
export const INSCREVA_CADASTRO_RAPIDO_ID = "cadastro-rapido";

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

/** Primeira letra de cada palavra maiúscula, restante minúscula. */
function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => (word.length === 0 ? "" : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
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

type CadastroRapidoSectionProps = {
  onRegistered: (student: StudentData, studentToken: string) => void;
  onCancel: () => void;
};

export function CadastroRapidoSection({ onRegistered, onCancel }: CadastroRapidoSectionProps) {
  const toast = useToast();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [guardianCpf, setGuardianCpf] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const age = ageFromBirthDate(birthDate);
  const isMinor = age != null && age < 18;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const t = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
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
      toast.push("error", "Os e-mails digitados não coincidem. Confira e tente novamente.");
      return;
    }
    if (isMinor && digitsGuardianCpf.length !== 11) {
      toast.push("error", "Para menores de 18 anos é obrigatório informar o CPF do responsável.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          ...(digitsCpf.length === 11 ? { cpf: digitsCpf } : {}),
          birthDate,
          phone: digitsPhone,
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          ...(isMinor && digitsGuardianCpf ? { guardianCpf } : {}),
          referralCode: readStoredReferralCode(),
        }),
      });
      const json = (await res.json()) as ApiResponse<{ student: StudentData; studentToken: string }>;
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok && "error" in json ? json.error.message : "Erro ao cadastrar.");
        return;
      }
      onRegistered(json.data.student, json.data.studentToken);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      id={INSCREVA_CADASTRO_RAPIDO_ID}
      ref={sectionRef}
      className={`scroll-mt-24 ${cardClass}`}
      role="region"
      aria-labelledby="cadastro-title"
    >
      <h2 id="cadastro-title" className="text-xl font-bold text-[var(--text-primary)]">
        Cadastro rápido
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
        Preencha os campos obrigatórios. E-mail é opcional; sem ele você precisará ir à secretaria para entregar documentos. Com e-mail, você acessa a área do aluno.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <fieldset className="space-y-4">
          <legend className="sr-only">Dados pessoais</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="cadastro-name" className={labelClass}>Nome *</label>
              <input
                id="cadastro-name"
                className={inputClass}
                value={name}
                onChange={(e) => setName(toTitleCase(e.target.value))}
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
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
              {birthDate && age != null && (
                <p className={hintClass}>
                  {age} anos{age < 18 ? " — informe o CPF do responsável abaixo" : ""}
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
            <label htmlFor="cadastro-email" className={labelClass}>E-mail (opcional)</label>
            <input
              id="cadastro-email"
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              placeholder="seu@email.com"
              autoComplete="email"
            />
            {email.trim().length > 0 && (
              <div className="mt-4">
                <label htmlFor="cadastro-email-confirm" className={labelClass}>Confirme seu e-mail</label>
                <input
                  id="cadastro-email-confirm"
                  className={inputClass}
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value.toLowerCase())}
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
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
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
                value={guardianCpf}
                onChange={(e) => setGuardianCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
            </div>
          </fieldset>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--card-border)] pt-6 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Cadastrando..." : "Cadastrar e continuar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import { NEXT_CYCLE_OTHER_COURSE } from "@/lib/validators/next-cycle-interest";

function formatPhoneInput(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type CourseOption = { id: string; name: string };

export function NextCycleInterestForm({
  courses,
  turnstileSiteKey = null,
}: {
  courses: CourseOption[];
  turnstileSiteKey?: string | null;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [courseId, setCourseId] = useState("");
  const [customCourseName, setCustomCourseName] = useState("");
  const [website, setWebsite] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const isOther = courseId === NEXT_CYCLE_OTHER_COURSE;

  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [courses],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (turnstileSiteKey && !captchaToken) {
      toast.push("error", "Confirme que você não é um robô antes de continuar.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/public/next-cycle-interest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          courseId: courseId || null,
          customCourseName: isOther ? customCourseName : null,
          captchaToken,
          website,
        }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<{
        message?: string;
      }> | null;
      if (!res.ok || !json || !json.ok) {
        toast.push(
          "error",
          json && !json.ok ? json.error.message : "Não foi possível registrar a pré-inscrição.",
        );
        return;
      }
      toast.push("success", json.data.message ?? "Pré-inscrição registrada!");
      setSent(true);
      setName("");
      setPhone("");
      setEmail("");
      setCourseId("");
      setCustomCourseName("");
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <p className="text-lg font-semibold text-[var(--igh-secondary)]">Pré-inscrição enviada!</p>
        <p className="mt-2 text-sm text-[var(--igh-muted)]">
          Recebemos seus dados. Quando o próximo ciclo abrir as matrículas, entraremos em contato.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={() => setSent(false)}
        >
          Enviar outra pré-inscrição
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="relative flex flex-col gap-4 rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] p-5 shadow-sm sm:p-6"
    >
      <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="next-cycle-website">Website</label>
        <input
          id="next-cycle-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="next-cycle-name" className="text-xs font-medium text-[var(--igh-muted)]">
          Nome completo *
        </label>
        <div className="mt-1">
          <Input
            id="next-cycle-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Seu nome completo"
          />
        </div>
      </div>

      <div>
        <label htmlFor="next-cycle-phone" className="text-xs font-medium text-[var(--igh-muted)]">
          Telefone / WhatsApp *
        </label>
        <div className="mt-1">
          <Input
            id="next-cycle-phone"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            type="tel"
            inputMode="numeric"
            required
            autoComplete="tel"
            placeholder="(91) 99999-9999"
          />
        </div>
      </div>

      <div>
        <label htmlFor="next-cycle-email" className="text-xs font-medium text-[var(--igh-muted)]">
          E-mail *
        </label>
        <div className="mt-1">
          <Input
            id="next-cycle-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
            placeholder="seu@email.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="next-cycle-course" className="text-xs font-medium text-[var(--igh-muted)]">
          Curso pretendido *
        </label>
        <select
          id="next-cycle-course"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          required
          className="theme-input mt-1 min-h-[44px] w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Selecione um curso</option>
          {sortedCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEXT_CYCLE_OTHER_COURSE}>Outro (digitar o nome)</option>
        </select>
      </div>

      {isOther ? (
        <div>
          <label
            htmlFor="next-cycle-custom-course"
            className="text-xs font-medium text-[var(--igh-muted)]"
          >
            Nome do curso *
          </label>
          <div className="mt-1">
            <Input
              id="next-cycle-custom-course"
              value={customCourseName}
              onChange={(e) => setCustomCourseName(e.target.value)}
              required
              placeholder="Digite o nome do curso desejado"
            />
          </div>
        </div>
      ) : null}

      {turnstileSiteKey ? (
        <TurnstileWidget siteKey={turnstileSiteKey} onToken={setCaptchaToken} />
      ) : null}

      <Button
        type="submit"
        disabled={loading || (!!turnstileSiteKey && !captchaToken)}
        className="w-full sm:w-auto"
      >
        {loading ? "Enviando…" : "Enviar pré-inscrição"}
      </Button>
    </form>
  );
}

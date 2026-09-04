"use client";

import { useMemo, useState } from "react";

import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

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
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [otherChecked, setOtherChecked] = useState(false);
  const [customCourseName, setCustomCourseName] = useState("");
  const [website, setWebsite] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [courses],
  );

  function toggleCourse(id: string, checked: boolean) {
    setCourseIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (courseIds.length === 0 && !otherChecked) {
      toast.push("error", "Selecione ao menos um curso ou marque “Outro”.");
      return;
    }
    if (otherChecked && customCourseName.trim().length < 2) {
      toast.push("error", "Digite o nome do curso em “Outro”.");
      return;
    }
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
          courseIds,
          customCourseName: otherChecked ? customCourseName : null,
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
      setCourseIds([]);
      setOtherChecked(false);
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
          Recebemos seus dados e enviamos um e-mail de confirmação. Quando o próximo ciclo abrir as
          matrículas, entraremos em contato.
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

      <fieldset>
        <legend className="text-xs font-medium text-[var(--igh-muted)]">
          Cursos pretendidos * (pode marcar mais de um)
        </legend>
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-md border border-[var(--igh-border)] bg-[var(--igh-surface)] px-3 py-2">
          {sortedCourses.map((c) => {
            const checked = courseIds.includes(c.id);
            return (
              <label
                key={c.id}
                className="flex cursor-pointer items-start gap-2 text-sm text-[var(--igh-secondary)]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleCourse(c.id, e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--igh-primary)]"
                />
                <span>{c.name}</span>
              </label>
            );
          })}
          <label className="flex cursor-pointer items-start gap-2 border-t border-[var(--igh-border)] pt-2 text-sm font-medium text-[var(--igh-secondary)]">
            <input
              type="checkbox"
              checked={otherChecked}
              onChange={(e) => setOtherChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--igh-primary)]"
            />
            <span>Outro (digitar o nome)</span>
          </label>
        </div>
      </fieldset>

      {otherChecked ? (
        <div>
          <label
            htmlFor="next-cycle-custom-course"
            className="text-xs font-medium text-[var(--igh-muted)]"
          >
            Nome do outro curso *
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

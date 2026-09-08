"use client";

import { Copy, Gift, Loader2, LogIn, Sparkles, Ticket, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site/Button";
import { GuestHolidayEventRegisterForm } from "@/components/site/GuestHolidayEventRegisterForm";
import { ReferrerPicker, type ReferrerOption } from "@/components/site/ReferrerPicker";
import type { ApiResponse } from "@/lib/api-types";

export type EventRegistrationPanelProps = {
  holidayId: string;
  occurrenceDate: string;
  eventPath: string;
  allowsRegistration: boolean;
  allowsReferral: boolean;
  requiresReferral: boolean;
  isPast: boolean;
  seatsLeft: number | null;
  raffleCount: number;
  isLoggedIn: boolean;
  turnstileSiteKey: string | null;
  initialReferrer: ReferrerOption | null;
  referralCode: string | null;
  myReferralLink: string | null;
};

export function EventRegistrationPanel({
  holidayId,
  occurrenceDate,
  eventPath,
  allowsRegistration,
  allowsReferral,
  requiresReferral,
  isPast,
  seatsLeft,
  raffleCount,
  isLoggedIn,
  turnstileSiteKey,
  initialReferrer,
  referralCode,
  myReferralLink,
}: EventRegistrationPanelProps) {
  const toast = useToast();
  const [registered, setRegistered] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(isLoggedIn);
  const [registering, setRegistering] = useState(false);
  const [referrer, setReferrer] = useState<ReferrerOption | null>(initialReferrer);
  const [referrerQuery, setReferrerQuery] = useState("");

  const loadMyStatus = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch(
        `/api/me/holiday-events/registrations?from=${occurrenceDate}&to=${occurrenceDate}`,
      );
      const json = (await res.json().catch(() => null)) as ApiResponse<{
        registrations: Array<{ holidayId: string; occurrenceDate: string }>;
      }> | null;
      if (json?.ok) {
        setRegistered(
          json.data.registrations.some(
            (r) => r.holidayId === holidayId && r.occurrenceDate === occurrenceDate,
          ),
        );
      }
    } finally {
      setCheckingStatus(false);
    }
  }, [holidayId, isLoggedIn, occurrenceDate]);

  useEffect(() => {
    void loadMyStatus();
  }, [loadMyStatus]);

  async function register() {
    if (registering) return;
    if (allowsReferral && requiresReferral && !referrer) {
      toast.push("error", "Selecione na lista quem indicou você.");
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch(`/api/me/holiday-events/${holidayId}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          occurrenceDate,
          referrerUserId: allowsReferral ? referrer?.id : undefined,
          referrerCode: allowsReferral && !referrer ? referralCode ?? undefined : undefined,
          referrerQuery: allowsReferral ? referrerQuery.trim() || undefined : undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ message?: string }> | null;
      if (!res.ok || !json || !json.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível concluir a inscrição.");
        return;
      }
      toast.push("success", json.data.message ?? "Inscrição confirmada!");
      setRegistered(true);
    } finally {
      setRegistering(false);
    }
  }

  async function copyReferralLink() {
    if (!myReferralLink) return;
    try {
      await navigator.clipboard.writeText(myReferralLink);
      toast.push("success", "Link de indicação copiado. Envie para quem você quer trazer.");
    } catch {
      toast.push("error", "Não foi possível copiar. Copie manualmente o link exibido.");
    }
  }

  if (!allowsRegistration) {
    return (
      <div className="rounded-xl border border-[var(--igh-border)] bg-[var(--igh-surface)] p-5">
        <p className="text-sm text-[var(--igh-muted)]">
          Este evento é informativo e não recebe inscrições pelo site.
        </p>
      </div>
    );
  }

  if (isPast) {
    return (
      <div className="rounded-xl border border-[var(--igh-border)] bg-[var(--igh-surface)] p-5">
        <p className="text-sm font-medium text-[var(--igh-secondary)]">Este evento já aconteceu.</p>
        <p className="mt-1 text-sm text-[var(--igh-muted)]">
          As inscrições desta data estão encerradas. Veja os próximos eventos abertos.
        </p>
        <Button as="link" href="/eventos" variant="outline" className="mt-4">
          Ver próximos eventos
        </Button>
      </div>
    );
  }

  if (seatsLeft != null && seatsLeft <= 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-medium text-amber-900">Vagas esgotadas</p>
        <p className="mt-1 text-sm text-amber-800">
          Todas as vagas desta data já foram preenchidas. Acompanhe o calendário para novas datas.
        </p>
        <Button as="link" href="/calendario" variant="outline" className="mt-4">
          Abrir calendário
        </Button>
      </div>
    );
  }

  const raffleNotice =
    raffleCount > 0 ? (
      <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
        <Gift className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {raffleCount > 1 ? `São ${raffleCount} sorteios` : "Há 1 sorteio"} neste evento. Seu número
          é gerado <strong>no dia, após a equipe confirmar sua presença no local</strong>. Quem se
          inscreve e não comparece não recebe número.
        </span>
      </p>
    ) : null;

  return (
    <div className="rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] p-5">
      <h2 className="text-lg font-semibold text-[var(--igh-secondary)]">Inscrição</h2>
      {seatsLeft != null ? (
        <p className="mt-1 text-xs font-medium text-[var(--igh-primary)]">
          {seatsLeft === 1 ? "Resta 1 vaga" : `Restam ${seatsLeft} vagas`}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {raffleNotice}

        {isLoggedIn ? (
          checkingStatus ? (
            <p className="flex items-center gap-2 text-sm text-[var(--igh-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando sua inscrição…
            </p>
          ) : registered ? (
            <p className="flex items-start gap-2 text-sm text-emerald-700">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              Você já está inscrito nesta data. Confira seu e-mail para o código de check-in.
            </p>
          ) : (
            <>
              {allowsReferral ? (
                <div>
                  <label
                    htmlFor="event-referrer"
                    className="text-xs font-medium text-[var(--igh-muted)]"
                  >
                    Quem indicou você {requiresReferral ? "*" : "(opcional)"}
                  </label>
                  <div className="mt-1">
                    <ReferrerPicker
                      inputId="event-referrer"
                      value={referrer}
                      locked={!!initialReferrer}
                      required={requiresReferral}
                      onChange={(option, query) => {
                        setReferrer(option);
                        setReferrerQuery(query);
                      }}
                    />
                  </div>
                </div>
              ) : null}
              <Button type="button" disabled={registering} onClick={() => void register()}>
                <Ticket className="mr-2 h-4 w-4" />
                {registering ? "Inscrevendo…" : "Inscrever-me neste evento"}
              </Button>
            </>
          )
        ) : (
          <>
            <p className="text-sm text-[var(--igh-muted)]">
              Entre na sua conta para se inscrever com 1 clique, ou use a inscrição rápida abaixo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button as="link" href={`/login?from=${encodeURIComponent(eventPath)}`}>
                <LogIn className="mr-2 h-4 w-4" />
                Entrar
              </Button>
              <Button
                as="link"
                variant="secondary"
                href={`/cadastro?from=${encodeURIComponent(eventPath)}`}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Criar conta
              </Button>
            </div>
            <GuestHolidayEventRegisterForm
              holidayId={holidayId}
              occurrenceDate={occurrenceDate}
              turnstileSiteKey={turnstileSiteKey}
              allowsReferral={allowsReferral}
              requiresReferral={requiresReferral}
              initialReferrer={initialReferrer}
              referrerLocked={!!initialReferrer}
            />
          </>
        )}

        {allowsReferral && myReferralLink ? (
          <div className="mt-1 rounded-lg border border-dashed border-[var(--igh-border)] bg-[var(--igh-surface)]/60 p-3">
            <p className="text-xs font-semibold text-[var(--igh-secondary)]">
              Indique alguém para este evento
            </p>
            <p className="mt-1 text-xs text-[var(--igh-muted)]">
              Compartilhe seu link: quem se inscrever por ele já entra com a sua indicação registrada.
            </p>
            <p className="mt-2 break-all rounded bg-[var(--card-bg)] px-2 py-1.5 text-xs text-[var(--igh-muted)]">
              {myReferralLink}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void copyReferralLink()}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar meu link
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type ConfirmDetails = {
  studentName: string;
  courseName: string;
  startDate: string;
  daysOfWeek: string;
  startTime: string;
  endTime: string;
  location: string | null;
};

function ConfirmarInscricaoContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [details, setDetails] = useState<ConfirmDetails | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!token?.trim()) {
      setError("Link inválido: token ausente.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/enrollment/confirm?token=${encodeURIComponent(token)}`);
      const json = (await res.json()) as ApiResponse<ConfirmDetails>;
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error.message : "Link inválido ou expirado.");
        return;
      }
      setDetails(json.data);
    } catch {
      setError("Erro ao carregar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !termsAccepted || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/enrollment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, termsAccepted: true }),
      });
      const json = (await res.json()) as ApiResponse<{ message: string; redirectTo?: string }>;
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error.message : "Falha ao confirmar. Tente novamente.");
        return;
      }
      setSuccess(true);
      const redirectTo = json.data?.redirectTo ?? "/login?confirmed=1";
      window.location.href = redirectTo;
    } catch {
      setError("Erro ao confirmar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-md px-2 text-center sm:px-0">
        <p className="text-zinc-600">Carregando...</p>
      </div>
    );
  }

  if (!token || error) {
    return (
      <div className="w-full max-w-md px-2 sm:px-0">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">Não foi possível exibir esta página</p>
          <p className="mt-1 text-sm">{error ?? "Link inválido ou expirado."}</p>
        </div>
        <p className="mt-4 text-center text-sm text-zinc-600">
          <Link href="/login" className="text-blue-600 underline hover:no-underline">
            Ir para o login
          </Link>
        </p>
      </div>
    );
  }

  if (!details) {
    return null;
  }

  return (
    <div className="w-full max-w-md px-2 sm:px-0">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold text-zinc-900">Confirme sua inscrição</h1>
        <p className="mt-2 text-zinc-600">
          Olá, <strong>{details.studentName}</strong>. Confira os dados da matrícula e aceite os termos para confirmar.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-zinc-500">Curso</dt>
            <dd className="font-medium">{details.courseName}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Início</dt>
            <dd>{details.startDate}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Dias da semana</dt>
            <dd>{details.daysOfWeek}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Horário</dt>
            <dd>{details.startTime} - {details.endTime}</dd>
          </div>
          {details.location && (
            <div>
              <dt className="text-zinc-500">Local</dt>
              <dd>{details.location}</dd>
            </div>
          )}
        </dl>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700">
              Li e aceito os termos de uso do sistema e confirmo minha inscrição nesta turma.
            </span>
          </label>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" disabled={!termsAccepted || submitting} className="w-full sm:w-auto">
              {submitting ? "Confirmando..." : "Confirmar inscrição"}
            </Button>
            <Link href="/login" className="w-full sm:w-auto">
              <Button type="button" variant="secondary" className="w-full">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </div>
      {success && (
        <p className="mt-4 text-center text-sm text-green-600">
          Inscrição confirmada. Redirecionando para o login...
        </p>
      )}
    </div>
  );
}

export default function ConfirmarInscricaoPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md px-2 text-center sm:px-0"><p className="text-zinc-600">Carregando...</p></div>}>
      <ConfirmarInscricaoContent />
    </Suspense>
  );
}

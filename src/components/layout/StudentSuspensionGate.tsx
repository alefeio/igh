"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { StudentSuspensionInfo } from "@/lib/student-suspension";

const ALLOWED_PREFIXES = [
  "/meus-dados",
  "/suporte",
  "/trocar-senha",
  "/escolher-perfil",
  "/onboarding",
];

function isAllowedWhileSuspended(pathname: string): boolean {
  return ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function StudentSuspensionGate({
  suspension,
  children,
}: {
  suspension: StudentSuspensionInfo | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (!suspension?.blocked || isAllowedWhileSuspended(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:py-14">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-6 dark:border-amber-800 dark:bg-amber-950/40">
        <h1 className="text-xl font-semibold text-amber-950 dark:text-amber-100">Matrícula suspensa</h1>
        <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100/90">
          Sua matrícula está <strong>suspensa</strong> porque você acumulou{" "}
          <strong>três faltas consecutivas sem justificativa</strong> na frequência da turma. Por isso, o acesso ao
          conteúdo e às atividades online está bloqueado.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100/90">
          Para voltar a acessar o portal, <strong>compareça à aula presencial</strong> e peça ao professor que
          registre sua <strong>presença</strong> na frequência. A matrícula será reativada automaticamente. Se a falta
          foi justificada, procure a secretaria do IGH.
        </p>
        {suspension.enrollments.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm text-amber-950 dark:text-amber-50">
            {suspension.enrollments.map((e) => (
              <li key={e.id} className="rounded-lg border border-amber-200/80 bg-white/60 px-3 py-2 dark:border-amber-800 dark:bg-black/20">
                <span className="font-medium">{e.courseName}</span>
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200/90">{e.classGroupLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/suporte"
          className="inline-flex items-center justify-center rounded-lg bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Falar com o suporte
        </Link>
        <Link
          href="/meus-dados"
          className="inline-flex items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
        >
          Meus dados
        </Link>
      </div>
    </div>
  );
}

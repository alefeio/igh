import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ClipboardList, Medal, UserPlus } from "lucide-react";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { ReferralShareCard } from "@/components/referral/ReferralShareCard";
import { getSessionUserFromCookie } from "@/lib/auth";
import { STUDENT_REFERRAL_POINTS } from "@/lib/referral-client";
import { listReferralsForUser } from "@/lib/student-referrals";

export const metadata = {
  title: "Minhas indicações",
  description: "Acompanhe quem você indicou e os pontos ganhos.",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

export default async function MinhasIndicacoesPage() {
  const user = await getSessionUserFromCookie();
  if (!user) redirect("/login");

  const { items, totals } = await listReferralsForUser(user.id);

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Indicações"
        title="Minhas indicações"
        description="Compartilhe seu link e acompanhe cadastros, primeiras presenças e certificações dos indicados."
      />

      <SectionCard
        title="Seu link de indicação"
        description="O código fica salvo no navegador de quem abrir o link, mesmo se a pessoa navegar pelo site antes de se cadastrar."
        variant="elevated"
      >
        <ReferralShareCard />
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={UserPlus}
          label="Cadastrados"
          value={totals.registered}
          hint={`+${STUDENT_REFERRAL_POINTS.registration} pts cada`}
        />
        <Stat
          icon={ClipboardList}
          label="1ª presença"
          value={totals.firstAttendance}
          hint={`+${STUDENT_REFERRAL_POINTS.firstAttendance} pts + ${STUDENT_REFERRAL_POINTS.subsequentAttendance}/presença`}
        />
        <Stat
          icon={Medal}
          label="Certificados"
          value={totals.certified}
          hint={`+${STUDENT_REFERRAL_POINTS.certification} pts cada`}
        />
        <Stat icon={CheckCircle2} label="Pontos totais" value={totals.points} hint="No ranking de alunos" />
      </div>

      <SectionCard title="Indicados" description="Lista de quem se cadastrou pelo seu link." variant="elevated">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Ainda não há indicações. Compartilhe seu link para começar.{" "}
            <Link href="/meus-dados" className="font-semibold text-[var(--igh-primary)] hover:underline">
              Ver em Meus dados
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="py-2 pr-3">Aluno</th>
                  <th className="py-2 pr-3">Cadastro</th>
                  <th className="py-2 pr-3">1ª presença</th>
                  <th className="py-2 pr-3">Presenças</th>
                  <th className="py-2 pr-3">Certificado</th>
                  <th className="py-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--card-border)]/70">
                    <td className="py-2.5 pr-3 font-medium text-[var(--text-primary)]">{item.studentName}</td>
                    <td className="py-2.5 pr-3 text-[var(--text-secondary)]">{formatDate(item.registeredAt)}</td>
                    <td className="py-2.5 pr-3 text-[var(--text-secondary)]">
                      {formatDate(item.firstAttendanceAt)}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-[var(--text-secondary)]">
                      {item.attendancePresentCount}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--text-secondary)]">{formatDate(item.certifiedAt)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--igh-primary)]">
                      {item.pointsEarned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof UserPlus;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
        <Icon className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}

"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatDaysOrderedPt } from "@/lib/turma-display";

export type EnrollmentSuccessPayload = {
  id: string;
  status: string;
  enrolledAt?: string | null;
  student: {
    id: string;
    name: string;
    email: string | null;
    phone?: string | null;
    birthDate?: string | null;
  };
  classGroup: {
    id: string;
    startDate?: string;
    daysOfWeek?: string[];
    startTime?: string;
    endTime?: string;
    location?: string | null;
    course: { id: string; name: string };
  };
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
};

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Belem" });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 border-b border-[var(--card-border)] py-2 last:border-b-0 sm:grid-cols-[9rem_1fr]">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--text-primary)]">{value || "—"}</dd>
    </div>
  );
}

export function EnrollmentSuccessModal({
  open,
  enrollment,
  emailSent,
  studentHadNoEmail,
  onClose,
  onEnrollAnotherClass,
}: {
  open: boolean;
  enrollment: EnrollmentSuccessPayload | null;
  emailSent: boolean;
  studentHadNoEmail: boolean;
  onClose: () => void;
  onEnrollAnotherClass: () => void;
}) {
  if (!enrollment) return null;

  const days =
    Array.isArray(enrollment.classGroup.daysOfWeek) && enrollment.classGroup.daysOfWeek.length
      ? formatDaysOrderedPt(enrollment.classGroup.daysOfWeek)
      : null;
  const schedule =
    enrollment.classGroup.startTime && enrollment.classGroup.endTime
      ? `${enrollment.classGroup.startTime}–${enrollment.classGroup.endTime}`
      : null;

  const emailNote = emailSent
    ? "E-mail de boas-vindas enviado."
    : studentHadNoEmail
      ? "Aluno sem e-mail; link de confirmação não enviado."
      : "E-mail de boas-vindas não foi enviado.";

  return (
    <Modal open={open} title="Matrícula concluída" onClose={onClose} size="small">
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Ficha do aluno recém-matriculado. Você pode matricular a mesma pessoa em outra turma sem
          pesquisar de novo.
        </p>

        <dl className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/60 px-3 py-1">
          <Row label="Aluno" value={<span className="font-semibold">{enrollment.student.name}</span>} />
          <Row label="E-mail" value={enrollment.student.email?.trim() || "—"} />
          <Row label="Telefone" value={enrollment.student.phone?.trim() || "—"} />
          <Row label="Nascimento" value={formatDateOnly(enrollment.student.birthDate)} />
          <Row label="Curso" value={enrollment.classGroup.course.name} />
          <Row
            label="Turma"
            value={[days, schedule, enrollment.classGroup.location?.trim()]
              .filter(Boolean)
              .join(" · ") || "—"}
          />
          <Row
            label="Status"
            value={
              <Badge tone="green">
                {STATUS_LABELS[enrollment.status] ?? enrollment.status}
              </Badge>
            }
          />
          <Row label="Aviso" value={emailNote} />
        </dl>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button type="button" onClick={onEnrollAnotherClass}>
            Matricular em outra turma
          </Button>
        </div>
      </div>
    </Modal>
  );
}

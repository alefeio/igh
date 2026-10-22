import { ENROLLMENT_HISTORY_KIND_LABEL, type EnrollmentHistoryKindValue } from "@/lib/enrollment-history";

export type TimelineItem = { at: string; label: string };

type AuditRow = { action: string; diffJson: string; createdAt: Date };

function parseDiff(raw: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function statusCancellationLabel(log: AuditRow): string | null {
  const diff = parseDiff(log.diffJson);
  if (log.action === "AUTO_CANCEL_ATTENDANCE") {
    const reason = typeof diff?.reason === "string" && diff.reason.trim() ? diff.reason.trim() : "matrícula cancelada por faltas consecutivas";
    return `Cancelamento: ${reason}.`;
  }
  if (log.action === "UPDATE") {
    const updates = diff?.updates;
    if (updates && typeof updates === "object" && !Array.isArray(updates) && (updates as { status?: unknown }).status === "CANCELLED") {
      return "Cancelamento: matrícula cancelada.";
    }
  }
  return null;
}

function emailCancellationLabel(log: AuditRow): string | null {
  if (log.action !== "EMAIL_SENT") return null;
  const diff = parseDiff(log.diffJson);
  if (diff?.type !== "enrollment_cancelled") return null;
  return "Cancelamento: matrícula cancelada.";
}

/** Data do cancelamento quando o histórico não tem um registro do tipo Cancelamento. */
export function cancellationTimelineItem(input: {
  status: string;
  historyKinds: readonly string[];
  audits: readonly AuditRow[];
}): TimelineItem | null {
  if (input.status !== "CANCELLED") return null;
  if (input.historyKinds.includes("CANCELAMENTO")) return null;

  const statusEvents = input.audits
    .map((log) => ({ log, label: statusCancellationLabel(log) }))
    .filter((row): row is { log: AuditRow; label: string } => row.label != null)
    .sort((a, b) => a.log.createdAt.getTime() - b.log.createdAt.getTime());
  const chosen = statusEvents[0];
  if (chosen) {
    return { at: chosen.log.createdAt.toISOString(), label: chosen.label };
  }

  const emailEvents = input.audits
    .map((log) => ({ log, label: emailCancellationLabel(log) }))
    .filter((row): row is { log: AuditRow; label: string } => row.label != null)
    .sort((a, b) => a.log.createdAt.getTime() - b.log.createdAt.getTime());
  const email = emailEvents[0];
  if (email) {
    return { at: email.log.createdAt.toISOString(), label: email.label };
  }

  return { at: "", label: "Cancelamento: matrícula cancelada." };
}

export function formatHistoryTimelineLabel(kind: string, body: string): string {
  const known = (ENROLLMENT_HISTORY_KIND_LABEL as Record<string, string>)[kind as EnrollmentHistoryKindValue];
  const title = known ?? kind;
  return `${title}: ${body}`;
}

export function sortTimeline(items: TimelineItem[]): TimelineItem[] {
  return [...items].sort((a, b) => {
    if (!a.at && !b.at) return 0;
    if (!a.at) return 1;
    if (!b.at) return -1;
    return a.at.localeCompare(b.at);
  });
}

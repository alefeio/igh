import { frequencyAbsenceLabels } from "@/lib/enrollment-frequency-label";

export function EnrollmentFrequencyLabel({
  presentCount,
  totalSessions,
  percent,
  justifiedAbsenceCount,
  unjustifiedAbsenceCount,
  align = "end",
}: {
  presentCount: number;
  totalSessions: number;
  percent: number | null;
  justifiedAbsenceCount: number;
  unjustifiedAbsenceCount: number;
  align?: "end" | "start";
}) {
  const labels = frequencyAbsenceLabels({ justifiedAbsenceCount, unjustifiedAbsenceCount });
  const alignClass = align === "end" ? "items-end text-right" : "items-start text-left";

  return (
    <span className={`flex flex-col gap-0.5 text-xs tabular-nums ${alignClass}`}>
      <span className="font-medium text-[var(--text-secondary)]">
        Frequência: {presentCount}/{totalSessions}
        {percent != null ? ` (${percent}%)` : ""}
      </span>
      {labels.unjustified || labels.justified ? (
        <span className="font-medium">
          {labels.unjustified ? <span className="text-rose-700 dark:text-rose-300">{labels.unjustified}</span> : null}
          {labels.unjustified && labels.justified ? <span className="text-[var(--text-muted)]"> · </span> : null}
          {labels.justified ? <span className="text-amber-800 dark:text-amber-200">{labels.justified}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

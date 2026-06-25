import Link from "next/link";

import {
  STUDENT_SUSPENSION_BLOCK_DETAIL,
  STUDENT_SUSPENSION_BLOCK_MESSAGE,
  STUDENT_SUSPENSION_BLOCK_TITLE,
} from "@/lib/student-suspension-messages";

type Props = {
  courseName?: string;
  className?: string;
  compact?: boolean;
};

export function StudentEnrollmentSuspensionBanner({ courseName, className = "", compact = false }: Props) {
  return (
    <div
      className={`rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 dark:border-amber-800 dark:bg-amber-950/40 ${className}`}
      role="alert"
    >
      <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
        {STUDENT_SUSPENSION_BLOCK_TITLE}
        {courseName ? (
          <>
            {" "}
            — <span className="font-semibold">{courseName}</span>
          </>
        ) : null}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100/90">
        {STUDENT_SUSPENSION_BLOCK_MESSAGE}
      </p>
      {!compact && (
        <p className="mt-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100/90">
          {STUDENT_SUSPENSION_BLOCK_DETAIL}
        </p>
      )}
      {!compact && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/suporte"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--igh-primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Falar com o suporte
          </Link>
        </div>
      )}
    </div>
  );
}

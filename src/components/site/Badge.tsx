import type { ReactNode } from "react";

const tones = {
  default: "bg-[var(--igh-surface)] text-[var(--igh-secondary)]",
  primary: "bg-[var(--igh-primary)]/10 text-[var(--igh-primary)]",
  accent: "bg-[var(--igh-accent)]/10 text-[var(--igh-accent)]",
} as const;

export function Badge({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

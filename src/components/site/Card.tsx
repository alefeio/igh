import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  as: Component = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
}) {
  return (
    <Component
      className={`rounded-xl border border-[var(--igh-border)] bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {children}
    </Component>
  );
}

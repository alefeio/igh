import type { ReactNode } from "react";
import { Container } from "./Container";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-[var(--igh-border)] bg-[var(--igh-surface)] py-12 sm:py-16">
      <Container>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--igh-secondary)] sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-lg text-[var(--igh-muted)]">{subtitle}</p>
        )}
        {children}
      </Container>
    </header>
  );
}

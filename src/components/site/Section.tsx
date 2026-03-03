import type { ReactNode } from "react";
import { Container } from "./Container";

type SectionProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  id?: string;
  className?: string;
  containerClassName?: string;
  background?: "white" | "muted";
};

export function Section({
  children,
  title,
  subtitle,
  id,
  className = "",
  containerClassName = "",
  background = "white",
}: SectionProps) {
  const bg = background === "muted" ? "bg-[var(--igh-surface)]" : "bg-white";
  return (
    <section id={id} className={`py-12 sm:py-16 lg:py-20 ${bg} ${className}`}>
      <Container className={containerClassName}>
        {(title || subtitle) && (
          <header className="mb-8 text-center sm:mb-10">
            {title && (
              <h2 className="text-2xl font-bold tracking-tight text-[var(--igh-secondary)] sm:text-3xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mx-auto mt-2 max-w-2xl text-[var(--igh-muted)] sm:text-lg">
                {subtitle}
              </p>
            )}
          </header>
        )}
        {children}
      </Container>
    </section>
  );
}

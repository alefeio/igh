import type { ReactNode } from "react";
import { Container } from "./Container";
import { Button } from "./Button";

type CTAItem = { label: string; href: string; variant?: "primary" | "secondary" | "accent" | "outline" };

export function CTASection({
  title,
  subtitle,
  primaryCTA,
  secondaryCTAs = [],
  children,
}: {
  title: string;
  subtitle?: string;
  primaryCTA?: CTAItem;
  secondaryCTAs?: CTAItem[];
  children?: ReactNode;
}) {
  return (
    <section className="bg-[var(--igh-primary)] py-12 text-white sm:py-16">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-3 text-lg text-white/90">{subtitle}</p>}
          {children}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {primaryCTA && (
              <Button
                as="link"
                href={primaryCTA.href}
                variant={primaryCTA.variant ?? "primary"}
                size="lg"
                className="!bg-[var(--igh-secondary-solid)] text-white hover:!opacity-90 focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-[var(--igh-primary)]"
              >
                {primaryCTA.label}
              </Button>
            )}
            {secondaryCTAs.map((cta) => (
              <Button key={cta.href} as="link" href={cta.href} variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
                {cta.label}
              </Button>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

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
  /** Quando informada, o cabeçalho da seção usa esta imagem de fundo (título e subtítulo em branco). */
  backgroundImageUrl?: string | null;
};

export function Section({
  children,
  title,
  subtitle,
  id,
  className = "",
  containerClassName = "",
  background = "white",
  backgroundImageUrl,
}: SectionProps) {
  const hasBgImage = !!backgroundImageUrl?.trim();
  const bg = !hasBgImage ? (background === "muted" ? "bg-[var(--igh-surface)]" : "bg-[var(--background)]") : "";
  return (
    <section id={id} className={`relative py-12 sm:py-16 lg:py-20 ${hasBgImage ? "overflow-hidden" : ""} ${bg} ${className}`}>
      {hasBgImage && (
        <>
          <div className="absolute inset-0 z-0">
            <img src={backgroundImageUrl!} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/50" aria-hidden />
          </div>
        </>
      )}
      <Container className={`relative ${hasBgImage ? "z-10" : ""} ${containerClassName}`}>
        {(title || subtitle) && (
          <header className="mb-8 text-center sm:mb-10">
            {title && (
              <h2
                className={`text-2xl font-bold tracking-tight sm:text-3xl ${
                  hasBgImage ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" : "text-[var(--igh-secondary)]"
                }`}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className={`mx-auto mt-2 max-w-2xl sm:text-lg ${
                  hasBgImage ? "text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" : "text-[var(--igh-muted)]"
                }`}
              >
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

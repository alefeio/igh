import type { ReactNode } from "react";
import { Container } from "./Container";

type SectionProps = {
  children: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  /** Classes do `<header>` (título + subtítulo). Por padrão há margem inferior ampla antes do conteúdo. */
  headerClassName?: string;
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
  headerClassName = "mb-8 text-center sm:mb-10",
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
          <header className={headerClassName}>
            {title && (
              <h2
                className={`text-2xl font-bold tracking-tight sm:text-3xl ${
                  hasBgImage ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" : "text-[var(--igh-secondary)]"
                }`}
              >
                {title}
              </h2>
            )}
            {subtitle != null && subtitle !== "" && (
              <div
                className={`mx-auto mt-2 max-w-2xl sm:text-lg ${
                  hasBgImage ? "text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" : "text-[var(--igh-muted)]"
                }`}
              >
                {subtitle}
              </div>
            )}
          </header>
        )}
        {children}
      </Container>
    </section>
  );
}

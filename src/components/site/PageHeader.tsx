import type { ReactNode } from "react";
import { Container } from "./Container";

export function PageHeader({
  title,
  subtitle,
  backgroundImageUrl,
  children,
  below,
}: {
  title: string;
  subtitle?: string;
  /** Quando informada, o cabeçalho usa a imagem de fundo com overlay escuro (título e subtítulo em branco). */
  backgroundImageUrl?: string | null;
  children?: ReactNode;
  /** Conteúdo em largura total, colado abaixo do título (fora do Container). */
  below?: ReactNode;
}) {
  const hasBg = !!backgroundImageUrl?.trim();
  const hasBelow = below != null;
  return (
    <header
      className={`relative border-b border-[var(--igh-border)] text-center ${
        hasBg
          ? "flex min-h-[280px] flex-col justify-center sm:min-h-[380px]"
          : "bg-[var(--igh-surface)]"
      } ${hasBelow ? "pb-0 pt-12 sm:pt-16" : "py-12 sm:py-16"}`}
    >
      {hasBg && (
        <>
          <div className="absolute inset-0 z-0">
            <img
              src={backgroundImageUrl!}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50" aria-hidden />
          </div>
        </>
      )}
      <Container className={`relative z-10 ${hasBelow ? "!pb-8 sm:!pb-10" : ""}`}>
        <h1
          className={`text-3xl font-bold tracking-tight sm:text-4xl ${
            hasBg ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" : "text-[var(--igh-secondary)]"
          }`}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`mx-auto mt-3 max-w-2xl text-lg ${
              hasBg ? "text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" : "text-[var(--igh-muted)]"
            }`}
          >
            {subtitle}
          </p>
        )}
        {children}
      </Container>
      {hasBelow && <div className="relative z-10 w-full">{below}</div>}
    </header>
  );
}

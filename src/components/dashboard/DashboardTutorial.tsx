"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const CONFIRM_DISPENSAR = "Tem certeza que deseja dispensar o tutorial?";

const STORAGE_KEY = "student-dashboard-tutorial-done";
const ARROW_SIZE = 10;
const GAP = 12;
/** Altitude estimada do card do tooltip para decidir se coloca acima ou abaixo do alvo */
const TOOLTIP_ESTIMATED_HEIGHT = 220;

export type TutorialStep = {
  /** Seletor CSS do elemento a destacar (ex: [data-tour="minhas-turmas"]). Null = só mostra o card. */
  target: string | null;
  title: string;
  content: string;
};

type Props = {
  /** Se false, o tutorial não é exibido (ex.: só para aluno no dashboard). */
  showForStudent: boolean;
  steps: TutorialStep[];
  /** Chave para identificar o tutorial (salva no banco e no localStorage como cache). Se não informada, usa a do dashboard. */
  storageKey?: string;
};

type TargetRect = { top: number; left: number; width: number; height: number; centerX: number; bottom: number };

export function DashboardTutorial({ showForStudent, steps, storageKey: storageKeyProp }: Props) {
  const storageKey = storageKeyProp ?? STORAGE_KEY;
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<{ top: number; left: number; arrow: "above" | "below" } | null>(null);
  /** null = ainda verificando, true = já concluído (não mostrar), false = não concluído (mostrar). */
  const [completedKnown, setCompletedKnown] = useState<boolean | null>(null);

  const endTutorial = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(storageKey, "true");
    } catch {}
    fetch("/api/me/tutorials-completed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ key: storageKey }),
    }).catch(() => {});
  }, [storageKey]);

  useEffect(() => {
    if (!showForStudent || steps.length === 0) return;
    let cancelled = false;
    fetch(`/api/me/tutorials-completed?key=${encodeURIComponent(storageKey)}`, { credentials: "include" })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) return res.json();
        if (res.status === 401) return null;
        return null;
      })
      .then((json) => {
        if (cancelled) return;
        if (json?.data?.completed === true) {
          try {
            localStorage.setItem(storageKey, "true");
          } catch {}
          setCompletedKnown(true);
          return;
        }
        if (json?.data?.completed === false || json === null) {
          setCompletedKnown(false);
          return;
        }
        setCompletedKnown(false);
      })
      .catch(() => {
        if (cancelled) return;
        try {
          if (localStorage.getItem(storageKey) === "true") {
            setCompletedKnown(true);
            return;
          }
        } catch {}
        setCompletedKnown(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showForStudent, steps.length, storageKey]);

  useEffect(() => {
    if (!showForStudent || steps.length === 0 || completedKnown !== false) return;
    setVisible(true);
    setStepIndex(0);
  }, [showForStudent, steps.length, completedKnown]);

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const updateTarget = useCallback(() => {
    if (!step?.target || typeof document === "undefined") {
      setTargetRect(null);
      setTooltipStyle(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el || !(el instanceof HTMLElement)) {
      setTargetRect(null);
      setTooltipStyle(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        bottom: rect.bottom,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [step?.target]);

  useEffect(() => {
    if (!visible || !step) return;
    const cleanup = updateTarget();
    const onResize = () => updateTarget();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cleanup?.();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [visible, stepIndex, step, updateTarget]);

  // Posicionar tooltip ao lado do alvo (seta apontando para o elemento). No final da página, coloca acima.
  useEffect(() => {
    if (!targetRect) {
      setTooltipStyle(null);
      return;
    }
    const maxW = 360;
    const vw = typeof window !== "undefined" ? window.innerWidth : 400;
    const vh = typeof window !== "undefined" ? window.innerHeight : 600;
    const left = Math.max(8, Math.min(targetRect.centerX - maxW / 2, vw - maxW - 8));
    const spaceBelow = vh - targetRect.bottom;
    const placeAbove = spaceBelow < TOOLTIP_ESTIMATED_HEIGHT + GAP + ARROW_SIZE;
    const topWhenAbove = targetRect.top - TOOLTIP_ESTIMATED_HEIGHT - GAP - ARROW_SIZE;
    setTooltipStyle({
      top: placeAbove
        ? Math.max(8, topWhenAbove)
        : targetRect.bottom + GAP + ARROW_SIZE,
      left,
      arrow: placeAbove ? "below" : "above",
    });
  }, [targetRect]);

  const handlePular = () => {
    if (isLast) endTutorial();
    else setStepIndex((i) => i + 1);
  };

  const handleFinalizar = () => {
    endTutorial();
  };

  const handleFechar = () => {
    if (typeof window !== "undefined" && window.confirm(CONFIRM_DISPENSAR)) {
      endTutorial();
    }
  };

  const handleAnterior = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  if (!visible || !step) return null;

  const hasTarget = step.target && targetRect;
  const showTooltipCentered = !hasTarget || !tooltipStyle;

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none"
      aria-hidden="true"
    >
      {/* Overlay bem leve só para dar foco (não escurece o alvo) */}
      <div className="absolute inset-0 bg-black/15 pointer-events-auto" aria-hidden="true" />

      {/* Área clicável: clicar fora não fecha, mas o overlay deixa o tooltip em evidência */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Tooltip apontando para o elemento */}
        {showTooltipCentered ? (
          <div className="pointer-events-auto fixed left-1/2 top-1/2 z-10 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl mx-4 relative">
            <button
              type="button"
              onClick={handleFechar}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              aria-label="Fechar e dispensar tutorial"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <h2 id="tutorial-title" className="pr-10 text-lg font-semibold text-[var(--text-primary)]">
              {step.title}
            </h2>
            <p id="tutorial-content" className="mt-2 text-sm text-[var(--text-secondary)]">
              {step.content}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-xs text-[var(--text-muted)]">
                {stepIndex + 1} de {steps.length}
              </span>
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={handleAnterior}
                  className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                >
                  Anterior
                </button>
              )}
              <button
                type="button"
                onClick={handleFinalizar}
                className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              >
                Pular
              </button>
              <button
                type="button"
                onClick={handlePular}
                className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              >
                {isLast ? "Concluir" : "Próximo"}
              </button>
            </div>
          </div>
        ) : (
          tooltipStyle && targetRect && (
            <div
              ref={cardRef}
              className="absolute z-10 w-full max-w-[360px] rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl pointer-events-auto relative"
              style={{
                top: tooltipStyle.top,
                left: tooltipStyle.left,
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tutorial-title"
              aria-describedby="tutorial-content"
            >
              <button
                type="button"
                onClick={handleFechar}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                aria-label="Fechar e dispensar tutorial"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
              {/* Seta: para cima quando tooltip está abaixo do alvo; para baixo quando está acima */}
              {tooltipStyle.arrow === "above" ? (
                <div
                  className="absolute w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[10px] border-b-[var(--card-bg)]"
                  style={{
                    left: Math.min(Math.max(targetRect.centerX - tooltipStyle.left - ARROW_SIZE, 8), 360 - ARROW_SIZE * 2 - 8),
                    top: -ARROW_SIZE,
                  }}
                  aria-hidden="true"
                />
              ) : (
                <div
                  className="absolute w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-[var(--card-bg)]"
                  style={{
                    left: Math.min(Math.max(targetRect.centerX - tooltipStyle.left - ARROW_SIZE, 8), 360 - ARROW_SIZE * 2 - 8),
                    bottom: -ARROW_SIZE,
                  }}
                  aria-hidden="true"
                />
              )}
              <h2 id="tutorial-title" className="pr-10 text-lg font-semibold text-[var(--text-primary)]">
                {step.title}
              </h2>
              <p id="tutorial-content" className="mt-2 text-sm text-[var(--text-secondary)]">
                {step.content}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                <span className="mr-auto text-xs text-[var(--text-muted)]">
                  {stepIndex + 1} de {steps.length}
                </span>
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handleAnterior}
                    className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                  >
                    Anterior
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleFinalizar}
                  className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                >
                  Pular
                </button>
                <button
                  type="button"
                  onClick={handlePular}
                  className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                >
                  {isLast ? "Concluir" : "Próximo"}
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

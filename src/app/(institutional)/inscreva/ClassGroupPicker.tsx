"use client";

import { useMemo, useState } from "react";
import {
  classGroupPoloLabel,
  classGroupUnitGroupKey,
  classGroupUnitLabel,
} from "@/lib/class-group-unit";
import { formatDaysShortPtBr } from "@/lib/turma-display";
import { formatDateOnlyBR, seatsLabel, type ClassGroupOption } from "./class-group-options";

type ClassGroupPickerProps = {
  classGroups: ClassGroupOption[];
  selectedIds: string[];
  onToggle: (cg: ClassGroupOption) => void;
  /** Turmas que o aluno não pode escolher agora (limite, curso repetido, conflito de horário). */
  isDisabled: (cg: ClassGroupOption) => boolean;
  emptyMessage: string;
};

type UnitGroup = {
  key: string;
  unitName: string;
  poloName: string | null;
  items: ClassGroupOption[];
};

/** Remove acentos e caixa para busca tolerante. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function groupByUnit(classGroups: ClassGroupOption[]): UnitGroup[] {
  const groups = new Map<string, UnitGroup>();
  for (const cg of classGroups) {
    const key = classGroupUnitGroupKey(cg.unit ?? null, cg.location);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(cg);
      continue;
    }
    groups.set(key, {
      key,
      unitName: classGroupUnitLabel(cg.unit ?? null, cg.location),
      poloName: classGroupPoloLabel(cg.unit ?? null),
      items: [cg],
    });
  }
  return [...groups.values()].sort((a, b) => a.unitName.localeCompare(b.unitName, "pt-BR"));
}

export function ClassGroupPicker({
  classGroups,
  selectedIds,
  onToggle,
  isDisabled,
  emptyMessage,
}: ClassGroupPickerProps) {
  const [query, setQuery] = useState("");
  const [unitKey, setUnitKey] = useState("");

  const allGroups = useMemo(() => groupByUnit(classGroups), [classGroups]);

  const visibleGroups = useMemo(() => {
    const q = normalize(query);
    return allGroups
      .filter((group) => !unitKey || group.key === unitKey)
      .map((group) => ({
        ...group,
        items: q
          ? group.items.filter(
              (cg) =>
                normalize(cg.courseName).includes(q) ||
                normalize(cg.courseDescription ?? "").includes(q)
            )
          : group.items,
      }))
      .filter((group) => group.items.length > 0);
  }, [allGroups, query, unitKey]);

  const visibleCount = visibleGroups.reduce((total, group) => total + group.items.length, 0);

  if (classGroups.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="inscreva-busca" className="sr-only">
            Buscar curso
          </label>
          <input
            id="inscreva-busca"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar curso…"
            className="min-h-[44px] w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)]/20"
          />
        </div>
        {allGroups.length > 1 ? (
          <div className="sm:w-64">
            <label htmlFor="inscreva-unidade" className="sr-only">
              Filtrar por polo ou unidade
            </label>
            <select
              id="inscreva-unidade"
              value={unitKey}
              onChange={(e) => setUnitKey(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)]/20"
            >
              <option value="">Todas as unidades</option>
              {allGroups.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.unitName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {visibleCount === 0 ? (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Nenhuma turma encontrada com esses filtros.
          </p>
        </div>
      ) : (
        visibleGroups.map((group) => (
          <section key={group.key} aria-labelledby={`unidade-${group.key}`}>
            <div className="mb-3 flex flex-wrap items-baseline gap-2 border-b border-[var(--card-border)] pb-2">
              <h3
                id={`unidade-${group.key}`}
                className="text-base font-bold text-[var(--text-primary)]"
              >
                {group.unitName}
              </h3>
              {group.poloName ? (
                <span className="text-xs text-[var(--text-muted)]">{group.poloName}</span>
              ) : null}
              <span className="ml-auto text-xs text-[var(--text-muted)]">
                {group.items.length === 1 ? "1 turma" : `${group.items.length} turmas`}
              </span>
            </div>
            <div
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              role="listbox"
              aria-label={`Turmas em ${group.unitName}`}
              aria-multiselectable="true"
            >
              {group.items.map((cg) => {
                const selected = selectedIds.includes(cg.id);
                const disabled = isDisabled(cg);
                const vagas = seatsLabel(cg);
                return (
                  <button
                    key={cg.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={disabled}
                    onClick={() => onToggle(cg)}
                    className={`flex h-full cursor-pointer flex-col rounded-xl border-2 p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10"
                        : disabled
                          ? "border-[var(--card-border)] bg-[var(--card-bg)]"
                          : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--igh-primary)]/50 hover:bg-[var(--igh-primary)]/5"
                    }`}
                  >
                    <span className="font-semibold text-[var(--text-primary)]">{cg.courseName}</span>
                    {cg.courseDescription?.trim() ? (
                      <span className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                        {cg.courseDescription.trim()}
                      </span>
                    ) : null}
                    <span className="mt-3 flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                      <span>{formatDaysShortPtBr(cg.daysOfWeek)}</span>
                      <span>
                        {cg.startTime}–{cg.endTime}
                      </span>
                      <span>Início {formatDateOnlyBR(cg.startDate)}</span>
                    </span>
                    <span className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                      {vagas ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:bg-sky-900/40 dark:text-sky-100">
                          {vagas}
                        </span>
                      ) : null}
                      <span
                        className={`ml-auto text-xs font-semibold ${
                          selected ? "text-[var(--igh-primary)]" : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {selected ? "Selecionada ✓" : disabled ? "Indisponível" : "Selecionar"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

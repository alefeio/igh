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

type CourseGroup = {
  courseId: string;
  courseName: string;
  courseDescription: string | null;
  items: ClassGroupOption[];
};

type UnitGroup = {
  key: string;
  unitName: string;
  poloName: string | null;
  courses: CourseGroup[];
  turmaCount: number;
};

/** Remove acentos e caixa para busca tolerante. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function groupByCourse(classGroups: ClassGroupOption[]): CourseGroup[] {
  const groups = new Map<string, CourseGroup>();
  for (const cg of classGroups) {
    const existing = groups.get(cg.courseId);
    if (existing) {
      existing.items.push(cg);
      continue;
    }
    groups.set(cg.courseId, {
      courseId: cg.courseId,
      courseName: cg.courseName,
      courseDescription: cg.courseDescription?.trim() || null,
      items: [cg],
    });
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
    .sort((a, b) => a.courseName.localeCompare(b.courseName, "pt-BR"));
}

function groupByUnitThenCourse(classGroups: ClassGroupOption[]): UnitGroup[] {
  const units = new Map<string, { unitName: string; poloName: string | null; items: ClassGroupOption[] }>();
  for (const cg of classGroups) {
    const key = classGroupUnitGroupKey(cg.unit ?? null, cg.location);
    const existing = units.get(key);
    if (existing) {
      existing.items.push(cg);
      continue;
    }
    units.set(key, {
      unitName: classGroupUnitLabel(cg.unit ?? null, cg.location),
      poloName: classGroupPoloLabel(cg.unit ?? null),
      items: [cg],
    });
  }

  return [...units.entries()]
    .map(([key, unit]) => {
      const courses = groupByCourse(unit.items);
      return {
        key,
        unitName: unit.unitName,
        poloName: unit.poloName,
        courses,
        turmaCount: unit.items.length,
      };
    })
    .sort((a, b) => a.unitName.localeCompare(b.unitName, "pt-BR"));
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

  const allUnits = useMemo(() => groupByUnitThenCourse(classGroups), [classGroups]);

  const visibleUnits = useMemo(() => {
    const q = normalize(query);
    return allUnits
      .filter((unit) => !unitKey || unit.key === unitKey)
      .map((unit) => {
        const courses = unit.courses
          .map((course) => ({
            ...course,
            items: q
              ? course.items.filter(
                  (cg) =>
                    normalize(cg.courseName).includes(q) ||
                    normalize(cg.courseDescription ?? "").includes(q)
                )
              : course.items,
          }))
          .filter((course) => course.items.length > 0);
        return {
          ...unit,
          courses,
          turmaCount: courses.reduce((total, course) => total + course.items.length, 0),
        };
      })
      .filter((unit) => unit.turmaCount > 0);
  }, [allUnits, query, unitKey]);

  const visibleCount = visibleUnits.reduce((total, unit) => total + unit.turmaCount, 0);

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
        {allUnits.length > 1 ? (
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
              {allUnits.map((unit) => (
                <option key={unit.key} value={unit.key}>
                  {unit.unitName}
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
        visibleUnits.map((unit) => (
          <section key={unit.key} aria-labelledby={`unidade-${unit.key}`} className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2 border-b border-[var(--card-border)] pb-2">
              <h3
                id={`unidade-${unit.key}`}
                className="text-base font-bold text-[var(--text-primary)]"
              >
                {unit.unitName}
              </h3>
              {unit.poloName ? (
                <span className="text-xs text-[var(--text-muted)]">{unit.poloName}</span>
              ) : null}
              <span className="ml-auto text-xs text-[var(--text-muted)]">
                {unit.turmaCount === 1 ? "1 turma" : `${unit.turmaCount} turmas`}
              </span>
            </div>

            <div className="space-y-3">
              {unit.courses.map((course) => (
                <div
                  key={`${unit.key}-${course.courseId}`}
                  className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]"
                >
                  <div className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]/60 px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">{course.courseName}</h4>
                      <span className="ml-auto text-xs text-[var(--text-muted)]">
                        {course.items.length === 1
                          ? "1 turma disponível"
                          : `${course.items.length} turmas disponíveis`}
                      </span>
                    </div>
                    {course.courseDescription ? (
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{course.courseDescription}</p>
                    ) : null}
                  </div>

                  <div
                    className="divide-y divide-[var(--card-border)]"
                    role="listbox"
                    aria-label={`Turmas de ${course.courseName} em ${unit.unitName}`}
                    aria-multiselectable="true"
                  >
                    {course.items.map((cg) => {
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
                          className={`flex w-full cursor-pointer flex-col gap-2 px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--igh-primary)] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row sm:items-center sm:gap-4 sm:px-5 ${
                            selected
                              ? "bg-[var(--igh-primary)]/10"
                              : disabled
                                ? "bg-[var(--card-bg)]"
                                : "bg-[var(--card-bg)] hover:bg-[var(--igh-primary)]/5"
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[var(--text-primary)]">
                              {formatDaysShortPtBr(cg.daysOfWeek)} · {cg.startTime}–{cg.endTime}
                            </span>
                            <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">
                              Início {formatDateOnlyBR(cg.startDate)}
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                            {vagas ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  cg.waitlistOnly || (cg.seatsLeft ?? 1) <= 0
                                    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                                    : "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100"
                                }`}
                              >
                                {vagas}
                              </span>
                            ) : null}
                            <span
                              className={`text-xs font-semibold ${
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
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

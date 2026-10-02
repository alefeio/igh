import { describe, expect, it } from "vitest";

import {
  COORDINATOR_FILTERS_STORAGE_KEY,
  clearPersistedCoordinatorFilters,
  coordinatorFiltersToSearchParams,
  filtersFromSearchParams,
  isDefaultCoordinatorContext,
  readPersistedCoordinatorFilters,
  resolveCoordinatorFilters,
  sanitizeCoordinatorFilters,
  writePersistedCoordinatorFilters,
} from "@/lib/coordinator/persisted-filters";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe("filtros persistentes da coordenação", () => {
  it("sem filtro salvo usa o ciclo atual como padrão da página", () => {
    const resolved = resolveCoordinatorFilters(
      { cycleId: false, courseId: false, classGroupId: false, teacherId: false, scope: false },
      {},
      {},
    );
    expect(resolved.cycleId).toBeUndefined();
    expect(isDefaultCoordinatorContext(resolved, "ciclo-atual")).toBe(true);
  });

  it("selecionar outro ciclo persiste e a navegação seguinte o lê", () => {
    const storage = memoryStorage();
    writePersistedCoordinatorFilters(storage, { cycleId: "ciclo-2", courseId: "web" });
    const saved = readPersistedCoordinatorFilters(storage);
    const nextPage = resolveCoordinatorFilters(
      { cycleId: false, courseId: false, classGroupId: false, teacherId: false, scope: false },
      {},
      saved,
    );
    expect(nextPage.cycleId).toBe("ciclo-2");
    expect(nextPage.courseId).toBe("web");
    expect(storage.getItem(COORDINATOR_FILTERS_STORAGE_KEY)).toContain("ciclo-2");
  });

  it("mantém o ciclo ao ir do painel para frequência e depois para evasão", () => {
    const saved = { cycleId: "ciclo-2" };
    const empty = { cycleId: false, courseId: false, classGroupId: false, teacherId: false, scope: false } as const;
    const frequencia = resolveCoordinatorFilters(empty, {}, saved);
    const evasao = resolveCoordinatorFilters(empty, {}, frequencia);
    expect(frequencia.cycleId).toBe("ciclo-2");
    expect(evasao.cycleId).toBe("ciclo-2");
  });

  it("refresh com a mesma URL mantém o ciclo", () => {
    const parsed = filtersFromSearchParams(new URLSearchParams("cycleId=ciclo-2"));
    const refreshed = resolveCoordinatorFilters(parsed.presence, parsed.filters, { cycleId: "ciclo-1" });
    expect(refreshed.cycleId).toBe("ciclo-2");
  });

  it("a query string vence o valor salvo", () => {
    const parsed = filtersFromSearchParams(new URLSearchParams("cycleId=ciclo-3"));
    const resolved = resolveCoordinatorFilters(parsed.presence, parsed.filters, { cycleId: "ciclo-2", courseId: "web" });
    expect(resolved.cycleId).toBe("ciclo-3");
    expect(resolved.courseId).toBe("web");
  });

  it("descarta ciclo salvo que não existe mais", () => {
    const sanitized = sanitizeCoordinatorFilters({ cycleId: "apagado", courseId: "web" }, { cycleIds: ["ciclo-2"] });
    expect(sanitized.cycleId).toBeUndefined();
    expect(sanitized.courseId).toBeUndefined();
  });

  it("remove a turma quando ela não pertence ao ciclo escolhido", () => {
    const sanitized = sanitizeCoordinatorFilters(
      { cycleId: "ciclo-3", classGroupId: "turma-x", courseId: "web" },
      { cycleIds: ["ciclo-3"], courseIds: ["web"], classGroupIds: ["outra"] },
    );
    expect(sanitized.cycleId).toBe("ciclo-3");
    expect(sanitized.courseId).toBe("web");
    expect(sanitized.classGroupId).toBeUndefined();
  });

  it("limpar filtros remove a persistência e volta ao ciclo atual", () => {
    const storage = memoryStorage();
    writePersistedCoordinatorFilters(storage, { cycleId: "ciclo-2" });
    clearPersistedCoordinatorFilters(storage);
    const cleared = readPersistedCoordinatorFilters(storage);
    expect(cleared).toEqual({});
    expect(isDefaultCoordinatorContext(cleared, "ciclo-atual")).toBe(true);
  });

  it("página que não consulta curso não apaga o courseId global", () => {
    const kept = sanitizeCoordinatorFilters({ cycleId: "ciclo-2", courseId: "web" }, { cycleIds: ["ciclo-2"] });
    expect(kept.courseId).toBe("web");
  });

  it("abrir a ficha não apaga o contexto salvo", () => {
    const storage = memoryStorage();
    writePersistedCoordinatorFilters(storage, { cycleId: "ciclo-2" });
    expect(readPersistedCoordinatorFilters(storage).cycleId).toBe("ciclo-2");
    expect(coordinatorFiltersToSearchParams({ cycleId: "ciclo-2" }).get("cycleId")).toBe("ciclo-2");
  });

  it("ignora json corrompido no armazenamento", () => {
    const storage = memoryStorage();
    storage.setItem(COORDINATOR_FILTERS_STORAGE_KEY, "{");
    expect(readPersistedCoordinatorFilters(storage)).toEqual({});
  });
});

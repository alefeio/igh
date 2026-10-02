export const COORDINATOR_FILTERS_STORAGE_KEY = "igh:coordinator:filters:v1";

export type CoordinatorScopeFilter = "all" | "internal" | "external";

export type CoordinatorPersistedFilters = {
  cycleId?: string;
  courseId?: string;
  classGroupId?: string;
  teacherId?: string;
  scope?: CoordinatorScopeFilter;
};

export const COORDINATOR_FILTER_QUERY_KEYS = ["cycleId", "courseId", "classGroupId", "teacherId", "scope"] as const;

export type CoordinatorFilterPresence = Record<(typeof COORDINATOR_FILTER_QUERY_KEYS)[number], boolean>;

export type CoordinatorFilterCatalog = {
  cycleIds?: string[];
  courseIds?: string[];
  teacherIds?: string[];
  classGroupIds?: string[];
};

const EMPTY_PRESENCE: CoordinatorFilterPresence = {
  cycleId: false,
  courseId: false,
  classGroupId: false,
  teacherId: false,
  scope: false,
};

function isScope(value: string | null): value is CoordinatorScopeFilter {
  return value === "all" || value === "internal" || value === "external";
}

export function filtersFromSearchParams(params: URLSearchParams): {
  filters: CoordinatorPersistedFilters;
  presence: CoordinatorFilterPresence;
} {
  const presence = { ...EMPTY_PRESENCE };
  const filters: CoordinatorPersistedFilters = {};
  if (params.has("cycleId")) {
    presence.cycleId = true;
    const value = params.get("cycleId")?.trim();
    if (value) filters.cycleId = value;
  }
  if (params.has("courseId")) {
    presence.courseId = true;
    const value = params.get("courseId")?.trim();
    if (value) filters.courseId = value;
  }
  if (params.has("classGroupId")) {
    presence.classGroupId = true;
    const value = params.get("classGroupId")?.trim();
    if (value) filters.classGroupId = value;
  }
  if (params.has("teacherId")) {
    presence.teacherId = true;
    const value = params.get("teacherId")?.trim();
    if (value) filters.teacherId = value;
  }
  if (params.has("scope")) {
    presence.scope = true;
    const value = params.get("scope");
    if (isScope(value)) filters.scope = value;
  }
  return { filters, presence };
}

export function readPersistedCoordinatorFilters(storage: Pick<Storage, "getItem"> | null): CoordinatorPersistedFilters {
  if (!storage) return {};
  try {
    const raw = storage.getItem(COORDINATOR_FILTERS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<CoordinatorPersistedFilters>;
    const filters: CoordinatorPersistedFilters = {};
    if (typeof parsed.cycleId === "string" && parsed.cycleId.trim()) filters.cycleId = parsed.cycleId.trim();
    if (typeof parsed.courseId === "string" && parsed.courseId.trim()) filters.courseId = parsed.courseId.trim();
    if (typeof parsed.classGroupId === "string" && parsed.classGroupId.trim()) filters.classGroupId = parsed.classGroupId.trim();
    if (typeof parsed.teacherId === "string" && parsed.teacherId.trim()) filters.teacherId = parsed.teacherId.trim();
    if (isScope(parsed.scope ?? null)) filters.scope = parsed.scope;
    return filters;
  } catch {
    return {};
  }
}

export function writePersistedCoordinatorFilters(
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
  filters: CoordinatorPersistedFilters,
) {
  if (!storage) return;
  const stored: CoordinatorPersistedFilters = {};
  if (filters.cycleId) stored.cycleId = filters.cycleId;
  if (filters.courseId) stored.courseId = filters.courseId;
  if (filters.classGroupId) stored.classGroupId = filters.classGroupId;
  if (filters.teacherId) stored.teacherId = filters.teacherId;
  if (filters.scope && filters.scope !== "all") stored.scope = filters.scope;
  try {
    if (Object.keys(stored).length === 0) storage.removeItem(COORDINATOR_FILTERS_STORAGE_KEY);
    else storage.setItem(COORDINATOR_FILTERS_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* armazenamento indisponível */
  }
}

export function clearPersistedCoordinatorFilters(storage: Pick<Storage, "removeItem"> | null) {
  try {
    storage?.removeItem(COORDINATOR_FILTERS_STORAGE_KEY);
  } catch {
    /* armazenamento indisponível */
  }
}

/** URL vence quando a chave está presente. O restante vem da persistência. */
export function resolveCoordinatorFilters(
  presence: CoordinatorFilterPresence,
  url: CoordinatorPersistedFilters,
  persisted: CoordinatorPersistedFilters,
): CoordinatorPersistedFilters {
  return {
    cycleId: presence.cycleId ? url.cycleId : persisted.cycleId,
    courseId: presence.courseId ? url.courseId : persisted.courseId,
    classGroupId: presence.classGroupId ? url.classGroupId : persisted.classGroupId,
    teacherId: presence.teacherId ? url.teacherId : persisted.teacherId,
    scope: presence.scope ? url.scope ?? "all" : persisted.scope ?? "all",
  };
}

export function sanitizeCoordinatorFilters(
  filters: CoordinatorPersistedFilters,
  catalog?: CoordinatorFilterCatalog,
): CoordinatorPersistedFilters {
  const next: CoordinatorPersistedFilters = { ...filters, scope: filters.scope ?? "all" };
  if (catalog?.cycleIds && next.cycleId && !catalog.cycleIds.includes(next.cycleId)) {
    return { scope: next.scope ?? "all" };
  }
  if (catalog?.courseIds && next.courseId && !catalog.courseIds.includes(next.courseId)) delete next.courseId;
  if (catalog?.teacherIds && next.teacherId && !catalog.teacherIds.includes(next.teacherId)) delete next.teacherId;
  if (catalog?.classGroupIds && next.classGroupId && !catalog.classGroupIds.includes(next.classGroupId)) {
    delete next.classGroupId;
  }
  return next;
}

export function coordinatorFiltersToSearchParams(filters: CoordinatorPersistedFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.cycleId) params.set("cycleId", filters.cycleId);
  if (filters.courseId) params.set("courseId", filters.courseId);
  if (filters.classGroupId) params.set("classGroupId", filters.classGroupId);
  if (filters.teacherId) params.set("teacherId", filters.teacherId);
  if (filters.scope && filters.scope !== "all") params.set("scope", filters.scope);
  return params;
}

export function isDefaultCoordinatorContext(
  filters: CoordinatorPersistedFilters,
  currentCycleId: string | null,
): boolean {
  const scope = filters.scope ?? "all";
  const cycleIsDefault = !filters.cycleId || (currentCycleId != null && filters.cycleId === currentCycleId);
  return cycleIsDefault && !filters.courseId && !filters.classGroupId && !filters.teacherId && scope === "all";
}

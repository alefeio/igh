"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type CoordinatorFilterCatalog,
  type CoordinatorPersistedFilters,
  clearPersistedCoordinatorFilters,
  coordinatorFiltersToSearchParams,
  filtersFromSearchParams,
  isDefaultCoordinatorContext,
  readPersistedCoordinatorFilters,
  resolveCoordinatorFilters,
  sanitizeCoordinatorFilters,
  writePersistedCoordinatorFilters,
} from "@/lib/coordinator/persisted-filters";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function useCoordinatorFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsed = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const [filters, setFilters] = useState<CoordinatorPersistedFilters>(parsed.filters);
  const [hydrated, setHydrated] = useState(false);

  const replaceUrl = useCallback(
    (next: CoordinatorPersistedFilters) => {
      const query = coordinatorFiltersToSearchParams(next).toString();
      const href = query ? `${pathname}?${query}` : pathname;
      const current = searchParams.toString();
      if (current === query) return;
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const persisted = readPersistedCoordinatorFilters(browserStorage());
    const resolved = resolveCoordinatorFilters(parsed.presence, parsed.filters, persisted);
    setFilters(resolved);
    writePersistedCoordinatorFilters(browserStorage(), resolved);
    replaceUrl(resolved);
    setHydrated(true);
    // A hidratação lê o armazenamento uma vez. Mudanças seguintes passam por update/clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(
    (partial: Partial<CoordinatorPersistedFilters>) => {
      setFilters((current) => {
        const next = sanitizeCoordinatorFilters({ ...current, ...partial, scope: partial.scope ?? current.scope ?? "all" });
        writePersistedCoordinatorFilters(browserStorage(), next);
        replaceUrl(next);
        return next;
      });
    },
    [replaceUrl],
  );

  const adoptCatalog = useCallback(
    (catalog: CoordinatorFilterCatalog) => {
      setFilters((current) => {
        const next = sanitizeCoordinatorFilters(current, catalog);
        const changed =
          next.cycleId !== current.cycleId ||
          next.courseId !== current.courseId ||
          next.teacherId !== current.teacherId ||
          next.classGroupId !== current.classGroupId;
        if (!changed) return current;
        writePersistedCoordinatorFilters(browserStorage(), next);
        replaceUrl(next);
        return next;
      });
    },
    [replaceUrl],
  );

  const clear = useCallback(() => {
    clearPersistedCoordinatorFilters(browserStorage());
    const next: CoordinatorPersistedFilters = { scope: "all" };
    setFilters(next);
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  return {
    filters,
    hydrated,
    update,
    adoptCatalog,
    clear,
    isDefault: (currentCycleId: string | null) => isDefaultCoordinatorContext(filters, currentCycleId),
  };
}

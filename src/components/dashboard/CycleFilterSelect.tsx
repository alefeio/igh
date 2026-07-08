"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type CycleSelectOption = {
  id: string;
  label: string;
};

export function CycleFilterSelect({
  cycles,
  selectedId,
  label = "Ciclo",
}: {
  cycles: CycleSelectOption[];
  selectedId: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (cycles.length === 0) return null;

  return (
    <label className="inline-flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
      <span className="font-medium text-[var(--text-secondary)]">{label}</span>
      <select
        className="theme-input h-10 min-w-[12rem] rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)]"
        value={selectedId}
        onChange={(e) => {
          const next = new URLSearchParams(searchParams.toString());
          next.set("cycleId", e.target.value);
          router.push(`${pathname}?${next.toString()}`);
        }}
      >
        {cycles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

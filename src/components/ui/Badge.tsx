export function Badge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "green" | "red" | "blue" | "amber" | "violet";
}) {
  const map: Record<NonNullable<typeof tone>, string> = {
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    red: "border-red-200 bg-red-50 text-red-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${map[tone]}`}
    >
      {children}
    </span>
  );
}

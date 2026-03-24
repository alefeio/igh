import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithoutRef, PropsWithChildren, ReactNode } from "react";

export type DashboardRole = "student" | "teacher" | "admin";

/** Role da sessão (UserProvider / layout) → gradiente do painel. */
export type SessionPanelRole = "MASTER" | "ADMIN" | "TEACHER" | "STUDENT";

export function sessionRoleToDashboardRole(role: SessionPanelRole): DashboardRole {
  if (role === "TEACHER") return "teacher";
  if (role === "STUDENT") return "student";
  return "admin";
}

/** Stack vertical padrão dentro do `container-page` do layout (evita repetir classes). */
export function PanelPageStack({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`flex min-w-0 flex-col gap-6 sm:gap-8 ${className}`.trim()}>{children}</div>;
}

/** Fundo suave e profundidade por perfil */
export function DashboardShell({ role, children }: { role: DashboardRole; children: ReactNode }) {
  const blob =
    role === "student"
      ? "from-violet-500/25 via-fuchsia-500/10 to-cyan-500/15 dark:from-violet-600/20 dark:via-fuchsia-600/10 dark:to-cyan-600/10"
      : role === "teacher"
        ? "from-amber-500/30 via-orange-400/10 to-rose-500/15 dark:from-amber-600/25 dark:via-orange-500/10 dark:to-rose-600/10"
        : "from-[var(--igh-primary)]/20 via-slate-400/10 to-emerald-500/15 dark:from-[var(--igh-primary)]/15 dark:via-slate-500/10 dark:to-emerald-600/10";

  return (
    <div className="relative min-w-0">
      <div
        className={`pointer-events-none absolute -top-4 left-1/2 h-[28rem] w-[min(100vw,72rem)] -translate-x-1/2 rounded-[50%] bg-gradient-to-b ${blob} blur-3xl opacity-70 dark:opacity-50`}
        aria-hidden
      />
      <div className="relative flex flex-col gap-8 pb-14 pt-2 sm:gap-10 sm:pt-4">{children}</div>
    </div>
  );
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  rightSlot,
  dataTour,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  rightSlot?: ReactNode;
  dataTour?: string;
}) {
  return (
    <header
      className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      data-tour={dataTour}
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="inline-flex items-center rounded-full border border-[var(--igh-primary)]/25 bg-[var(--igh-primary)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--igh-primary)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <div className="mt-3 max-w-xl text-base leading-relaxed text-[var(--text-muted)]">{description}</div>
        ) : null}
      </div>
      {rightSlot ? <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">{rightSlot}</div> : null}
    </header>
  );
}

export function StatTile({
  label,
  value,
  href,
  sublabel,
  icon: Icon,
  accent = "default",
}: {
  label: string;
  value: number | string;
  href?: string;
  sublabel?: string;
  icon: LucideIcon;
  accent?: "default" | "emerald" | "violet" | "amber" | "sky" | "rose";
}) {
  const accents = {
    default: "from-[var(--igh-primary)]/25 to-[var(--igh-primary)]/5 text-[var(--igh-primary)]",
    emerald: "from-emerald-500/30 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    violet: "from-violet-500/30 to-violet-500/5 text-violet-600 dark:text-violet-400",
    amber: "from-amber-500/30 to-amber-500/5 text-amber-600 dark:text-amber-400",
    sky: "from-sky-500/30 to-sky-500/5 text-sky-600 dark:text-sky-400",
    rose: "from-rose-500/30 to-rose-500/5 text-rose-600 dark:text-rose-400",
  };

  const inner = (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[var(--igh-primary)]/35 hover:shadow-md sm:p-5">
      <div
        className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--igh-primary)]/10 blur-2xl transition group-hover:bg-[var(--igh-primary)]/15"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner ${accents[accent]}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-3xl">
            {value}
          </p>
          {sublabel ? <p className="mt-1 text-xs leading-snug text-[var(--text-muted)]">{sublabel}</p> : null}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-2xl focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function SectionCard({
  title,
  description,
  id,
  dataTour,
  action,
  children,
  className = "",
  variant = "default",
}: {
  title: string;
  description?: string;
  id?: string;
  dataTour?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated";
}) {
  const base =
    variant === "elevated"
      ? "rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-md ring-1 ring-black/[0.03] dark:ring-white/[0.04]"
      : "rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/90 shadow-sm backdrop-blur-sm";

  return (
    <section
      className={`${base} p-4 sm:p-6 ${className}`}
      {...(id ? { "aria-labelledby": id } : {})}
      data-tour={dataTour}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 {...(id ? { id } : {})} className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {title}
          </h2>
          {description ? <p className="mt-1.5 max-w-prose text-sm text-[var(--text-muted)]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function QuickActionGrid({
  items,
  dataTour,
}: {
  items: {
    href: string;
    label: string;
    description: string;
    icon: LucideIcon;
    accent: string;
    dataTour?: string;
  }[];
  dataTour?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-tour={dataTour}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
        <Link
          key={item.href + item.label}
          href={item.href}
          data-tour={item.dataTour}
          className="group flex items-center gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[var(--igh-primary)]/30 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:p-5"
        >
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${item.accent}`}
          >
            <Icon className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--igh-primary)]">
              {item.label}
            </span>
            <p className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">{item.description}</p>
          </div>
          <span className="text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--igh-primary)]" aria-hidden>
            →
          </span>
        </Link>
        );
      })}
    </div>
  );
}

/** Barra de comparação visual para contagens (ex.: turmas por status) */
export function StatusBars({
  rows,
  max,
}: {
  rows: { label: string; value: number; tone?: "default" | "success" | "warning" | "muted" }[];
  max: number;
}) {
  const tones = {
    default: "bg-[var(--igh-primary)]",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    muted: "bg-[var(--text-muted)]/40",
  };

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const pct = max > 0 ? Math.max(4, Math.round((row.value / max) * 100)) : 0;
        return (
          <li key={row.label}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-[var(--text-secondary)]">{row.label}</span>
              <span className="tabular-nums font-semibold text-[var(--text-primary)]">{row.value}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--igh-surface)]">
              <div
                className={`h-full rounded-full transition-all ${tones[row.tone ?? "default"]}`}
                style={{ width: `${row.value === 0 ? 0 : pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type TableShellProps = PropsWithChildren<
  Omit<ComponentPropsWithoutRef<"table">, "children">
>;

/** Wrapper com scroll horizontal; filhos devem ser elementos de tabela (caption, thead, tbody), sem outro &lt;table&gt; aninhado. */
export function TableShell({ children, className, ...tableProps }: TableShellProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-inner">
      <table
        className={["min-w-full text-sm text-[var(--text-primary)]", className].filter(Boolean).join(" ")}
        {...tableProps}
      >
        {children}
      </table>
    </div>
  );
}

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base =
    "inline-flex cursor-pointer items-center justify-center rounded-md font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation";

  const styles: Record<Variant, string> = {
    primary:
      "bg-zinc-900 text-white hover:bg-zinc-800 hover:brightness-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:brightness-95",
    secondary:
      "bg-[var(--igh-surface)] text-[var(--text-primary)] border border-[var(--card-border)] hover:opacity-90 hover:brightness-95",
    danger: "bg-red-600 text-white hover:bg-red-700 hover:brightness-95",
    ghost:
      "bg-transparent text-[var(--text-muted)] hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)]",
  };

  const sizes: Record<Size, string> = {
    sm: "px-2.5 py-1.5 text-xs min-h-[36px] sm:min-h-0",
    md: "px-3 py-2 text-sm min-h-[44px] sm:min-h-0",
    lg: "px-4 py-2.5 text-base min-h-[44px] sm:min-h-0",
  };

  return (
    <button
      className={`${base} ${styles[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

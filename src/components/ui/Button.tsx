import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";
type Size = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base =
    "inline-flex cursor-pointer items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation";

  const styles: Record<Variant, string> = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800",
    secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-zinc-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
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

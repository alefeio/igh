import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`theme-input min-h-[44px] w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)] sm:h-10 sm:min-h-0 ${className}`}
      {...props}
    />
  );
}

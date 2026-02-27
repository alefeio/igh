import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-[44px] w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900 sm:h-10 sm:min-h-0 ${className}`}
      {...props}
    />
  );
}

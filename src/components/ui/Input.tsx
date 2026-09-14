import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`theme-input min-h-[44px] w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)] sm:h-10 sm:min-h-0 ${className}`}
        {...props}
      />
    );
  },
);

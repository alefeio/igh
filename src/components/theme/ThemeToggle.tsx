"use client";

import { useTheme } from "./ThemeProvider";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
  "aria-label"?: string;
};

export function ThemeToggle({ className = "", showLabel = false, "aria-label": ariaLabel }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  const label = theme === "dark" ? "Usar tema claro" : "Usar tema escuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center gap-2 rounded-lg p-2 text-[var(--text-secondary)] transition hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2 ${className}`}
      aria-label={ariaLabel ?? label}
      title={label}
    >
      {theme === "dark" ? (
        <span aria-hidden className="flex h-5 w-5 items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        </span>
      ) : (
        <span aria-hidden className="flex h-5 w-5 items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </span>
      )}
      {showLabel && (
        <span className="text-sm font-medium">
          {theme === "dark" ? "Claro" : "Escuro"}
        </span>
      )}
    </button>
  );
}

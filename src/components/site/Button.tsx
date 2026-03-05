import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Base = {
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = Base &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof Base> & {
    as?: "button";
    href?: never;
  };

type ButtonAsLink = Base &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof Base> & {
  as: "link";
  href: string;
};

type ButtonProps = ButtonAsButton | ButtonAsLink;

const variants = {
  primary:
    "bg-[var(--igh-primary)] text-white hover:bg-[var(--igh-primary-hover)] hover:brightness-95 focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2",
  secondary:
    "bg-[var(--card-bg)] text-[var(--igh-primary)] border-2 border-[var(--igh-primary)] hover:bg-[var(--igh-primary)] hover:text-white hover:brightness-95 focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2",
  accent:
    "bg-[var(--igh-accent)] text-white hover:bg-[var(--igh-accent-hover)] hover:brightness-95 focus:ring-2 focus:ring-[var(--igh-accent)] focus:ring-offset-2",
  outline:
    "bg-transparent text-[var(--igh-secondary)] border border-[var(--igh-border)] hover:bg-[var(--igh-surface)] hover:brightness-[0.98] focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2",
} as const;

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonProps & {
  variant?: keyof typeof variants;
  size?: "sm" | "md" | "lg";
}) {
  const base =
    "inline-flex cursor-pointer items-center justify-center rounded-lg font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 touch-manipulation min-h-[44px] focus:outline-none";
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-6 py-3 text-lg",
  };
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if (rest.as === "link" && "href" in rest) {
    const { as, href, ...aProps } = rest;
    return (
      <a href={href} className={cls} {...aProps}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}

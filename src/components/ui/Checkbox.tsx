import type { InputHTMLAttributes } from "react";

export function Checkbox({
  className = "",
  checked,
  onCheckedChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <input
      {...props}
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={`h-4 w-4 cursor-pointer accent-[var(--igh-primary)] ${className}`}
    />
  );
}


"use client";

import type { InputHTMLAttributes } from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={`pr-10 ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
        title={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

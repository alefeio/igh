"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

export type ReferrerOption = {
  id: string;
  name: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  roleLabel: string;
};

const MIN_LENGTH = 3;

function optionHint(option: ReferrerOption): string {
  return [option.roleLabel, option.emailMasked, option.phoneMasked].filter(Boolean).join(" · ");
}

/**
 * Combobox de indicador: só permite escolher alguém já cadastrado.
 * Os contatos vêm mascarados da API, apenas para desambiguar homônimos.
 */
export function ReferrerPicker({
  value,
  onChange,
  required = false,
  locked = false,
  inputId = "referrer-search",
}: {
  value: ReferrerOption | null;
  onChange: (option: ReferrerOption | null, query: string) => void;
  required?: boolean;
  /** Indicador já definido pelo link ?ref=, sem opção de troca. */
  locked?: boolean;
  inputId?: string;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ReferrerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (value || locked) return;
    const term = query.trim();
    if (term.length < MIN_LENGTH) {
      setOptions([]);
      setSearched(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/public/holiday-events/referrers?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        const json = (await res.json().catch(() => null)) as ApiResponse<{
          candidates: ReferrerOption[];
        }> | null;
        if (json?.ok) {
          setOptions(json.data.candidates);
          setOpen(true);
        } else {
          setOptions([]);
        }
        setSearched(true);
      } catch {
        // Busca abortada por nova digitação: ignora.
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, value, locked]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-900">
            <Check className="h-4 w-4 shrink-0" />
            <span className="truncate">{value.name}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-emerald-800">{optionHint(value)}</p>
        </div>
        {locked ? null : (
          <button
            type="button"
            className="shrink-0 rounded p-1 text-emerald-800 hover:bg-emerald-100"
            aria-label="Trocar indicador"
            onClick={() => {
              onChange(null, "");
              setQuery("");
              setOptions([]);
              setSearched(false);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--igh-muted)]" />
        <Input
          id={inputId}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(null, e.target.value);
          }}
          onFocus={() => options.length > 0 && setOpen(true)}
          required={required}
          autoComplete="off"
          className="pl-9"
          placeholder="Digite o nome, e-mail ou telefone de quem indicou"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--igh-muted)]" />
        ) : null}
      </div>

      {open && query.trim().length >= MIN_LENGTH ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full list-none overflow-auto rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] p-1 shadow-lg">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--igh-muted)]">
              {loading
                ? "Buscando…"
                : searched
                  ? "Nenhum cadastro encontrado. Só é possível indicar quem já tem cadastro."
                  : "Digite para buscar."}
            </li>
          ) : (
            options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="w-full rounded px-3 py-2 text-left hover:bg-[var(--igh-surface)]"
                  onClick={() => {
                    onChange(option, query);
                    setOpen(false);
                  }}
                >
                  <span className="block text-sm font-medium text-[var(--igh-secondary)]">
                    {option.name}
                  </span>
                  <span className="block text-xs text-[var(--igh-muted)]">{optionHint(option)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      <p className="mt-1 text-xs text-[var(--igh-muted)]">
        Digite ao menos {MIN_LENGTH} caracteres e selecione o nome na lista.
      </p>
    </div>
  );
}

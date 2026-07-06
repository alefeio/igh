"use client";

import { useCallback, useEffect, useState } from "react";

import type { ApiResponse } from "@/lib/api-types";

function normalizeTag(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

export function CommunityTagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await fetch("/api/igh-community/tags");
      const json = (await res.json()) as ApiResponse<{ tags: string[] }>;
      if (res.ok && json.ok) setSuggestions(json.data.tags);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (tag.length < 2 || value.includes(tag)) return;
    if (value.length >= 8) return;
    onChange([...value, tag]);
    setInput("");
  };

  const filtered = suggestions
    .filter((s) => !value.includes(s) && (!input || s.includes(normalizeTag(input))))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[var(--text-secondary)]">
        Tags
        <div className="mt-1 flex flex-wrap gap-2">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--igh-primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-primary)]/20"
            >
              #{tag}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
        <input
          className="mt-2 w-full rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(input);
            }
          }}
          placeholder="Digite e pressione Enter (ex.: inovação, equipe, mvp)"
        />
      </label>
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filtered.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--igh-primary)] hover:text-[var(--igh-primary)]"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

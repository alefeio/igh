"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type Template = {
  id: string;
  name: string;
  description: string | null;
  categoryHint: string | null;
  content: string;
  active: boolean;
  createdAt: string;
};

export default function SmsTemplatesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryHint, setCategoryHint] = useState("");
  const [content, setContent] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/sms/templates");
      const json = (await res.json()) as ApiResponse<{ items: Template[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Falha ao carregar." : "Falha ao carregar.");
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setCategoryHint("");
    setContent("");
    setActive(true);
    setOpen(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setName(t.name);
    setDescription(t.description ?? "");
    setCategoryHint(t.categoryHint ?? "");
    setContent(t.content);
    setActive(t.active);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.push("error", "Nome é obrigatório.");
      return;
    }
    if (!content.trim()) {
      toast.push("error", "Conteúdo é obrigatório.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        categoryHint: categoryHint.trim() || null,
        content: content.trim(),
        active: editing ? undefined : active,
      };
      const url = editing ? `/api/sms/templates/${editing.id}` : "/api/sms/templates";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...payload, active } : payload),
      });
      const json = (await res.json()) as ApiResponse<{ template: Template }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Falha ao salvar." : "Falha ao salvar.");
        return;
      }
      toast.push("success", editing ? "Template atualizado." : "Template criado.");
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: Template) {
    const res = await fetch(`/api/sms/templates/${t.id}/toggle-active`, { method: "PATCH" });
    const json = (await res.json()) as ApiResponse<{ template: Template }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message ?? "Falha ao alterar." : "Falha ao alterar.");
      return;
    }
    toast.push("success", json.data.template.active ? "Template ativado." : "Template desativado.");
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/sms" className="text-[var(--igh-primary)] hover:underline">← Campanhas</Link>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Templates SMS</h1>
        </div>
        <Button onClick={openCreate}>Novo template</Button>
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)]">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-[var(--text-muted)]">Nenhum template. Crie um para usar em campanhas.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--bg)] p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)]">{t.name}</span>
                  {!t.active && <Badge tone="zinc">Inativo</Badge>}
                </div>
                {t.description && (
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{t.description}</p>
                )}
                <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{t.content}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => toggleActive(t)}>
                  {t.active ? "Desativar" : "Ativar"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openEdit(t)}>Editar</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar template" : "Novo template"}>
        <form onSubmit={save} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Descrição</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Dica de categoria</label>
            <Input value={categoryHint} onChange={(e) => setCategoryHint(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Conteúdo *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={1600}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              required
            />
            <p className="text-xs text-[var(--text-muted)]">Placeholders: {"{nome}"}, {"{primeiro_nome}"}, {"{turma}"}, {"{curso}"}, {"{unidade}"}, {"{link}"}</p>
          </div>
          {!editing && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span className="text-sm">Ativo</span>
            </label>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

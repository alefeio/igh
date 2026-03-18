"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type Template = {
  id: string;
  name: string;
  description: string | null;
  categoryHint: string | null;
  subjectTemplate: string;
  htmlContent: string | null;
  textContent: string | null;
  active: boolean;
  createdAt: string;
};

function sanitizeHtmlForPreview(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const blocked = ["script", "iframe", "object", "embed", "link", "meta"];
    for (const tag of blocked) doc.querySelectorAll(tag).forEach((n) => n.remove());
    doc.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value ?? "";
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
          continue;
        }
        if ((name === "href" || name === "src") && value.trim().toLowerCase().startsWith("javascript:")) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return doc.body.innerHTML;
  } catch {
    return "";
  }
}

export default function EmailTemplatesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryHint, setCategoryHint] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [textContent, setTextContent] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const htmlPreview = useMemo(
    () => sanitizeHtmlForPreview(htmlContent ?? ""),
    [htmlContent]
  );

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/email/templates");
      const json = (await res.json()) as ApiResponse<{ items: Template[] }>;
      if (!res.ok || !json.ok) {
        toast.push(
          "error",
          !json.ok ? json.error?.message ?? "Falha ao carregar." : "Falha ao carregar."
        );
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
    setSubjectTemplate("");
    setHtmlContent("");
    setTextContent("");
    setActive(true);
    setOpen(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setName(t.name);
    setDescription(t.description ?? "");
    setCategoryHint(t.categoryHint ?? "");
    setSubjectTemplate(t.subjectTemplate);
    setHtmlContent(t.htmlContent ?? "");
    setTextContent(t.textContent ?? "");
    setActive(t.active);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.push("error", "Nome é obrigatório.");
      return;
    }
    if (!subjectTemplate.trim()) {
      toast.push("error", "Assunto do template é obrigatório.");
      return;
    }
    const hasHtml =
      htmlContent.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim() !== "";
    const hasText = textContent.trim() !== "";
    if (!hasHtml && !hasText) {
      toast.push("error", "Informe o conteúdo em HTML e/ou texto.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        categoryHint: categoryHint.trim() || null,
        subjectTemplate: subjectTemplate.trim(),
        htmlContent: hasHtml ? htmlContent.trim() : null,
        textContent: hasText ? textContent.trim() : null,
        active: editing ? undefined : active,
      };
      const url = editing
        ? `/api/email/templates/${editing.id}`
        : "/api/email/templates";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...payload, active } : payload),
      });
      const json = (await res.json()) as ApiResponse<{ template: Template }>;
      if (!res.ok || !json.ok) {
        toast.push(
          "error",
          !json.ok ? json.error?.message ?? "Falha ao salvar." : "Falha ao salvar."
        );
        return;
      }
      toast.push(
        "success",
        editing ? "Template atualizado." : "Template criado."
      );
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: Template) {
    const res = await fetch(`/api/email/templates/${t.id}/toggle-active`, {
      method: "PATCH",
    });
    const json = (await res.json()) as ApiResponse<{ template: Template }>;
    if (!res.ok || !json.ok) {
      toast.push(
        "error",
        !json.ok ? json.error?.message ?? "Falha ao alterar." : "Falha ao alterar."
      );
      return;
    }
    toast.push(
      "success",
      json.data.template.active ? "Template ativado." : "Template desativado."
    );
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/admin/email"
            className="text-[var(--igh-primary)] hover:underline"
          >
            ← Campanhas
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            Templates de E-mail
          </h1>
        </div>
        <Button onClick={openCreate}>Novo template</Button>
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)]">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          Nenhum template. Crie um para usar em campanhas.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--bg)] p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)]">
                    {t.name}
                  </span>
                  {!t.active && <Badge tone="zinc">Inativo</Badge>}
                </div>
                {t.description && (
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {t.description}
                  </p>
                )}
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  <strong>Assunto:</strong> {t.subjectTemplate}
                </p>
                {(t.htmlContent || t.textContent) && (
                  <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
                    {t.htmlContent
                      ? t.htmlContent.replace(/<[^>]+>/g, "").slice(0, 80)
                      : t.textContent?.slice(0, 80)}
                    ...
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleActive(t)}
                >
                  {t.active ? "Desativar" : "Ativar"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEdit(t)}
                >
                  Editar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar template" : "Novo template"}
      >
        <form onSubmit={save} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Descrição
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Dica de categoria
            </label>
            <Input
              value={categoryHint}
              onChange={(e) => setCategoryHint(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Assunto do template *
            </label>
            <Input
              value={subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              placeholder="Ex.: Olá {primeiro_nome}, ..."
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Conteúdo HTML (opcional)
            </label>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="Corpo em HTML (opcional)."
              rows={6}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm"
            />
            <div className="mt-2 rounded border border-[var(--border)] bg-[var(--card-bg)] p-3">
              <div className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                Pré-visualização
              </div>
              {htmlPreview.trim() ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: htmlPreview }}
                />
              ) : (
                <div className="text-sm text-[var(--text-muted)]">
                  (Sem HTML para pré-visualizar)
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Placeholders: {"{nome}"}, {"{primeiro_nome}"}, {"{curso}"}, {"{turma}"} (dias · horário · local),{" "}
              {"{data_inicio}"}, {"{horario}"}, {"{local}"}, {"{link}"} e {"{link_area_aluno}"} (login — URL em{" "}
              <strong>Site → Configurações → URL pública</strong> ou <code className="text-xs">APP_URL</code>),{" "}
              {"{telefone_igh}"} e {"{email_suporte}"} (definir PUBLIC_CONTACT_PHONE e PUBLIC_SUPPORT_EMAIL no .env).{" "}
              Lista de matrículas (HTML): {"{cursos_html}"}, {"{matriculas_html}"}, {"{cursos}"} ou{" "}
              <code className="text-xs">[cursos_html]</code> / entidades HTML se o editor escapar chaves. Texto:{" "}
              {"{matriculas_texto}"}; {"{cursos_matriculados}"}, {"{turmas_matriculadas}"}. Pendentes na fila são
              re-renderizados no envio.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Conteúdo texto (opcional)
            </label>
            <RichTextEditor
              key={(editing?.id ?? "template-new") + "-text"}
              value={textContent}
              onChange={setTextContent}
              placeholder="Digite o corpo do e-mail..."
              minHeight="220px"
              className="rounded border border-[var(--border)] bg-[var(--bg)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Pelo menos HTML ou texto. Mesmos placeholders do campo HTML.
            </p>
          </div>
          {!editing && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span className="text-sm">Ativo</span>
            </label>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { ApimagesImageUpload } from "@/components/admin/ApimagesImageUpload";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import type { LegalDocumentKind, LegalDocumentStatus } from "@/generated/prisma/client";

const KINDS: { value: LegalDocumentKind; label: string; hint: string }[] = [
  { value: "TERMS", label: "Termos de uso", hint: "Regras gerais de uso do site e serviços." },
  { value: "PRIVACY", label: "Política de privacidade", hint: "Tratamento de dados pessoais (LGPD)." },
  { value: "COOKIE_POLICY", label: "Política de cookies", hint: "Cookies e tecnologias similares (complementa o aviso do banner)." },
];

const STATUS_LABEL: Record<LegalDocumentStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

type Row = {
  id: string;
  kind: LegalDocumentKind;
  versionLabel: string;
  title: string;
  status: LegalDocumentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string; email: string } | null;
};

export default function AdminLegalDocumentsPage() {
  const toast = useToast();
  const [kindTab, setKindTab] = useState<LegalDocumentKind>("TERMS");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [title, setTitle] = useState("");
  const [contentRich, setContentRich] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/site/legal/versions?kind=${kindTab}`);
      const json = (await res.json()) as ApiResponse<{ items: Row[] }>;
      if (!res.ok || !json.ok || !json.data) {
        toast.push("error", "Falha ao carregar versões.");
        return;
      }
      setRows(json.data.items);
    } finally {
      setLoading(false);
    }
  }, [kindTab, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setVersionLabel("");
    setTitle("");
    setContentRich("<p></p>");
    setEditorOpen(true);
  }

  async function openEdit(id: string) {
    const res = await fetch(`/api/admin/site/legal/versions/${id}`);
    const json = (await res.json()) as ApiResponse<{
      item: {
        id: string;
        kind: LegalDocumentKind;
        versionLabel: string;
        title: string;
        contentRich: string;
        status: LegalDocumentStatus;
      };
    }>;
    if (!res.ok || !json.ok || !json.data) {
      toast.push("error", "Falha ao abrir versão.");
      return;
    }
    const it = json.data.item;
    if (it.status !== "DRAFT") {
      toast.push("error", "Só é possível editar rascunhos.");
      return;
    }
    setEditingId(it.id);
    setVersionLabel(it.versionLabel);
    setTitle(it.title);
    setContentRich(it.contentRich || "<p></p>");
    setEditorOpen(true);
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!versionLabel.trim()) {
      toast.push("error", "Informe o rótulo da versão (ex.: 1.0 ou 2025-03).");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/site/legal/versions/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), contentRich }),
        });
        const json = (await res.json()) as ApiResponse<unknown>;
        if (!res.ok || !json.ok) {
          toast.push("error", "Falha ao salvar.");
          return;
        }
        toast.push("success", "Rascunho atualizado.");
      } else {
        const res = await fetch("/api/admin/site/legal/versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: kindTab,
            versionLabel: versionLabel.trim(),
            title: title.trim(),
            contentRich,
          }),
        });
        const json = (await res.json()) as ApiResponse<{ item: { id: string } }>;
        if (!res.ok || !json.ok || !json.data) {
          toast.push("error", "Falha ao criar rascunho.");
          return;
        }
        toast.push("success", "Rascunho criado.");
      }
      setEditorOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function publish(id: string) {
    if (!confirm("Publicar esta versão? A versão publicada anterior deste tipo será arquivada.")) return;
    const res = await fetch(`/api/admin/site/legal/versions/${id}/publish`, { method: "POST" });
    const json = (await res.json()) as ApiResponse<unknown>;
    if (!res.ok || !json.ok) {
      toast.push("error", "Falha ao publicar.");
      return;
    }
    toast.push("success", "Versão publicada.");
    await load();
  }

  async function removeDraft(id: string) {
    if (!confirm("Excluir este rascunho?")) return;
    const res = await fetch(`/api/admin/site/legal/versions/${id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<unknown>;
    if (!res.ok || !json.ok) {
      toast.push("error", "Falha ao excluir.");
      return;
    }
    toast.push("success", "Rascunho excluído.");
    await load();
  }

  const kindMeta = KINDS.find((k) => k.value === kindTab);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <DashboardHero
        eyebrow="Site"
        title="Termos, privacidade e cookies"
        description="Crie versões em rascunho, edite o conteúdo em rich text e publique. Ao publicar uma nova versão, os visitantes e usuários logados precisarão aceitar novamente no banner do site. A política de cookies é opcional e complementa o aviso LGPD; cookies não essenciais (analytics/marketing) costumam exigir ferramenta ou configuração adicional."
      />

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKindTab(k.value)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              kindTab === k.value
                ? "bg-[var(--igh-primary)] text-white"
                : "border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-primary)] hover:opacity-90"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kindMeta ? <p className="text-sm text-[var(--text-muted)]">{kindMeta.hint}</p> : null}

      <SectionCard title={`Versões — ${kindMeta?.label ?? ""}`} variant="elevated">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" onClick={openCreate}>
            Nova versão (rascunho)
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma versão cadastrada para este tipo.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Versão</Th>
                <Th>Status</Th>
                <Th>Publicação</Th>
                <Th>Criado por</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">{r.versionLabel}</Td>
                  <Td>
                    <Badge tone={r.status === "PUBLISHED" ? "green" : r.status === "DRAFT" ? "zinc" : "amber"}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </Td>
                  <Td className="text-sm text-[var(--text-muted)]">
                    {r.publishedAt ? new Date(r.publishedAt).toLocaleString("pt-BR") : "—"}
                  </Td>
                  <Td className="text-sm text-[var(--text-muted)]">
                    {r.createdBy?.name ?? "—"}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {r.status === "DRAFT" ? (
                        <>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void openEdit(r.id)}>
                            Editar
                          </Button>
                          <Button type="button" size="sm" onClick={() => void publish(r.id)}>
                            Publicar
                          </Button>
                          <Button type="button" size="sm" variant="danger" onClick={() => void removeDraft(r.id)}>
                            Excluir
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">Somente leitura</span>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal open={editorOpen} title={editingId ? "Editar rascunho" : "Nova versão"} onClose={() => setEditorOpen(false)} size="large">
        <form onSubmit={(e) => void saveDraft(e)} className="flex flex-col gap-4">
          {!editingId ? (
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Rótulo da versão *</label>
              <Input
                className="mt-1"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="Ex.: 1.0 ou 2025-03-01"
                required
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              Versão: <strong className="text-[var(--text-primary)]">{versionLabel}</strong> (não editável)
            </p>
          )}
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Título opcional</label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cabeçalho exibido na página pública" />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Imagens no texto</label>
            <div className="mt-2">
              <ApimagesImageUpload
                kind="legal"
                onUploaded={(url) => {
                  void navigator.clipboard?.writeText(url).catch(() => {});
                  toast.push("success", "URL copiada para a área de transferência.");
                }}
                label="Upload de imagem"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Conteúdo</label>
            <RichTextEditor value={contentRich} onChange={setContentRich} minHeight="320px" className="mt-2" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : editingId ? "Salvar rascunho" : "Criar rascunho"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

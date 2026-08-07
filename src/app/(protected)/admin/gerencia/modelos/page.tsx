"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import type { DocumentTemplateType } from "@/generated/prisma/client";

type Template = {
  id: string;
  type: DocumentTemplateType;
  title: string;
  contentRich: string;
  isActive: boolean;
  updatedAt: string;
};

const TYPE_LABEL: Record<DocumentTemplateType, string> = {
  CONTRATO: "Contrato",
  DISTRATO: "Distrato",
  TERMO_DOACAO: "Termo de doação",
};

export default function ModelosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<DocumentTemplateType>("CONTRATO");
  const [title, setTitle] = useState("");
  const [contentRich, setContentRich] = useState("<p></p>");
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gerencia/modelos", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ templates: Template[]; variables: string[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar modelos.");
        return;
      }
      setTemplates(json.data.templates);
      setVariables(json.data.variables);
    } catch {
      toast.push("error", "Falha ao carregar modelos.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setType("CONTRATO");
    setTitle("");
    setContentRich(
      "<p>Contrato de colaboração entre {{instituto.nome}} e {{funcionario.nome}}, CPF {{funcionario.cpf}}.</p><p>Cargo: {{funcionario.cargo}}. Valor mensal: {{contrato.valor}}. Início: {{contrato.inicio}}.</p>",
    );
    setIsActive(true);
    setOpen(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setType(t.type);
    setTitle(t.title);
    setContentRich(t.contentRich);
    setIsActive(t.isActive);
    setOpen(true);
  }

  async function save() {
    if (!title.trim()) {
      toast.push("error", "Informe o título do modelo.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/admin/gerencia/modelos/${editing.id}` : "/api/admin/gerencia/modelos",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, title, contentRich, isActive }),
        },
      );
      const json = (await res.json()) as ApiResponse<{ template: Template }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", editing ? "Modelo atualizado." : "Modelo criado.");
      setOpen(false);
      void load();
    } catch {
      toast.push("error", "Falha ao salvar modelo.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Template) {
    if (!window.confirm(`Excluir o modelo "${t.title}"?`)) return;
    const res = await fetch(`/api/admin/gerencia/modelos/${t.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted?: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Modelo excluído.");
    void load();
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência · Documentos"
        title="Modelos oficiais"
        description="Edite os textos de contrato, distrato e termo de doação. Use variáveis para preencher dados do colaborador."
        rightSlot={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Novo modelo
          </Button>
        }
      />

      <SectionCard title="Variáveis disponíveis" variant="elevated">
        <div className="flex flex-wrap gap-2">
          {variables.map((v) => (
            <code
              key={v}
              className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-1 text-xs"
            >
              {v}
            </code>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Modelos cadastrados" variant="elevated">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum modelo ainda. Crie o primeiro.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Título</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <Td className="font-medium">{t.title}</Td>
                  <Td>{TYPE_LABEL[t.type]}</Td>
                  <Td>
                    <Badge tone={t.isActive ? "green" : "zinc"}>
                      {t.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void remove(t)}>
                        Excluir
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar modelo" : "Novo modelo"}
        size="large"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Tipo</span>
              <select
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
                value={type}
                onChange={(e) => setType(e.target.value as DocumentTemplateType)}
              >
                {(Object.keys(TYPE_LABEL) as DocumentTemplateType[]).map((k) => (
                  <option key={k} value={k}>
                    {TYPE_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Título</span>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Modelo ativo (disponível na emissão)
          </label>
          <div>
            <p className="mb-2 text-sm text-[var(--text-muted)]">Conteúdo</p>
            <RichTextEditor value={contentRich} onChange={setContentRich} minHeight="280px" />
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar modelo"}
            </Button>
          </div>
        </div>
      </Modal>
    </PanelPageStack>
  );
}

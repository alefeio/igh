"use client";

import { useCallback, useEffect, useState } from "react";
import { SortableTableRows, SortableTableDndWrapper } from "@/components/admin/SortableTableRows";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
};

export default function FaqPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FaqItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isActive, setIsActive] = useState(true);

  function resetForm() {
    setQuestion("");
    setAnswer("");
    setIsActive(true);
    setEditing(null);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/faq");
      const json = (await res.json()) as ApiResponse<{ items: FaqItem[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar.");
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
    resetForm();
    setOpen(true);
  }

  function openEdit(item: FaqItem) {
    setEditing(item);
    setQuestion(item.question);
    setAnswer(item.answer);
    setIsActive(item.isActive);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast.push("error", "Pergunta e resposta são obrigatórios.");
      return;
    }
    const url = editing ? `/api/admin/site/faq/${editing.id}` : "/api/admin/site/faq";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.trim(), answer: answer.trim(), isActive }),
    });
    const json = (await res.json()) as ApiResponse<{ item: FaqItem }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
      return;
    }
    toast.push("success", editing ? "Item atualizado." : "Item criado.");
    setOpen(false);
    resetForm();
    await load();
  }

  async function remove(item: FaqItem) {
    if (!confirm("Excluir este item?")) return;
    const res = await fetch(`/api/admin/site/faq/${item.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Item excluído.");
    await load();
  }

  const handleReorder = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/admin/site/faq", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json()) as ApiResponse<{ items: FaqItem[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Falha ao reordenar." : "Falha ao reordenar.");
        return;
      }
      toast.push("success", "Ordem atualizada.");
      setItems(json.data.items);
    },
    [toast]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">FAQ</div>
          <div className="text-sm text-[var(--text-secondary)]">Perguntas frequentes do site.</div>
        </div>
        <Button onClick={openCreate}>Novo item</Button>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      ) : (
        <SortableTableDndWrapper items={items} onReorder={handleReorder}>
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>Ordem</Th>
                <Th>Pergunta</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <SortableTableRows items={items} onReorder={handleReorder} noDndWrapper emptyMessage="Nenhum item no FAQ.">
            {(item) => (
              <>
                <Td>{item.order + 1}</Td>
                <Td>
                  <div className="font-medium text-[var(--text-primary)]">{item.question}</div>
                </Td>
                <Td>{item.isActive ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(item)}>Editar</Button>
                    <Button variant="secondary" className="text-red-600" onClick={() => remove(item)}>Excluir</Button>
                  </div>
                </Td>
              </>
            )}
            </SortableTableRows>
          </Table>
        </SortableTableDndWrapper>
      )}

      <Modal open={open} title={editing ? "Editar item" : "Novo item"} onClose={() => { setOpen(false); resetForm(); }}>
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Pergunta</label>
            <Input className="mt-1" value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Resposta</label>
            <textarea
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              rows={4}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="faqActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="faqActive" className="text-sm">Ativo</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

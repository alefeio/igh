"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type MenuItem = { id: string; label: string; href: string; order: number; parentId: string | null; isExternal: boolean; isVisible: boolean };

export default function MenuPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [isVisible, setIsVisible] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/menu");
      const json = (await res.json()) as ApiResponse<{ flat: MenuItem[] }>;
      if (!res.ok || !json.ok) toast.push("error", !json.ok ? json.error.message : "Falha ao carregar.");
      else setItems(json.data.flat);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setLabel("");
    setHref("");
    setIsVisible(true);
    setOpen(true);
  }

  function openEdit(m: MenuItem) {
    setEditing(m);
    setLabel(m.label);
    setHref(m.href);
    setIsVisible(m.isVisible);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !href.trim()) return;
    const url = editing ? `/api/admin/site/menu/${editing.id}` : "/api/admin/site/menu";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), href: href.trim(), isVisible }),
    });
    const json = (await res.json()) as ApiResponse<{ item: MenuItem }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
      return;
    }
    toast.push("success", editing ? "Item atualizado." : "Item criado.");
    setOpen(false);
    load();
  }

  async function remove(m: MenuItem) {
    if (!confirm("Excluir este item?")) return;
    const res = await fetch(`/api/admin/site/menu/${m.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
    else {
      toast.push("success", "Item excluído.");
      load();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Menu</div>
          <div className="text-sm text-zinc-600">Itens do menu do site.</div>
        </div>
        <Button onClick={openCreate}>Novo item</Button>
      </div>
      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Ordem</Th>
              <Th>Label</Th>
              <Th>Link</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <Td>{m.order + 1}</Td>
                <Td className="font-medium">{m.label}</Td>
                <Td className="text-sm text-zinc-600">{m.href}</Td>
                <Td>
                  <Button variant="secondary" onClick={() => openEdit(m)}>Editar</Button>
                  <Button variant="secondary" className="ml-2 text-red-600" onClick={() => remove(m)}>Excluir</Button>
                </Td>
              </tr>
            ))}
            {items.length === 0 && <tr><Td colSpan={4} className="text-zinc-600">Nenhum item.</Td></tr>}
          </tbody>
        </Table>
      )}
      <Modal open={open} title={editing ? "Editar item" : "Novo item"} onClose={() => setOpen(false)}>
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Label</label>
            <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Link</label>
            <Input className="mt-1" value={href} onChange={(e) => setHref(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="vis" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} />
            <label htmlFor="vis" className="text-sm">Visível</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

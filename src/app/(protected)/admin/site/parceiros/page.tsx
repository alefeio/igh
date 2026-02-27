"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

export default function ParceirosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<unknown[]>([]);

  useEffect(() => {
    fetch("/api/admin/site/partners")
      .then((r) => r.json())
      .then((json: ApiResponse<{ items: unknown[] }>) => {
        if (json.ok) setItems(json.data.items);
        else toast.push("error", json.error.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-lg font-semibold">Parceiros</div>
      <div className="text-sm text-zinc-600">Parceiros. API: /api/admin/site/partners</div>
      {loading ? <div className="text-sm text-zinc-600">Carregando...</div> : (
        <p className="text-zinc-600">{items.length} parceiro(s) cadastrado(s).</p>
      )}
    </div>
  );
}

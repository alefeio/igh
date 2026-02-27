"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

export default function DepoimentosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/admin/site/testimonials")
      .then((r) => r.json())
      .then((json: ApiResponse<{ items: unknown[] }>) => {
        if (json.ok) setCount(json.data.items.length);
        else toast.push("error", json.error.message);
      })
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-lg font-semibold">Depoimentos</div>
      <div className="text-sm text-zinc-600">Depoimentos. API: /api/admin/site/testimonials</div>
      {loading ? <div className="text-sm text-zinc-600">Carregando...</div> : <p className="text-zinc-600">{count} depoimento(s).</p>}
    </div>
  );
}

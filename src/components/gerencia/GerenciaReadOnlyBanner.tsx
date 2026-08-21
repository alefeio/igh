"use client";

import { useUser } from "@/components/layout/UserProvider";

/** Aviso de somente leitura para o perfil Diretor nas telas de Gerência. */
export function GerenciaReadOnlyBanner() {
  const user = useUser();
  if (user.role !== "DIRECTOR") return null;
  return (
    <div
      className="mb-4 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
      role="status"
    >
      Você está no perfil <strong>Diretor</strong>: pode acompanhar e detalhar os dados da Gerência, mas não
      criar, editar ou excluir registros.
    </div>
  );
}

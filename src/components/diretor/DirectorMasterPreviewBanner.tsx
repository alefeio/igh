"use client";

import { useUser } from "@/components/layout/UserProvider";

export function DirectorMasterPreviewBanner() {
  const user = useUser();
  if (user.role !== "MASTER") return null;
  return (
    <div
      className="mb-4 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
      role="status"
    >
      <strong>Visualização do perfil Diretor.</strong> Você está no perfil Master em modo somente
      leitura — sem impersonação e sem alterar o token ativo.
    </div>
  );
}

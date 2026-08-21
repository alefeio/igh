import { ZodError } from "zod";

import { jsonErr } from "@/lib/http";

export function directorApiError(e: unknown): Response {
  if (e instanceof ZodError) {
    return jsonErr("VALIDATION", "Filtros inválidos.", 400, e.flatten());
  }
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return jsonErr("FORBIDDEN", "Acesso restrito ao perfil Diretor (ou preview Master).", 403);
  }
  if (e instanceof Error && e.message === "UNAUTHENTICATED") {
    return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
  }
  console.error("[diretor/api]", e);
  return jsonErr("INTERNAL", "Falha ao processar a solicitação.", 500);
}

/** Métodos de mutação bloqueados na área analítica do Diretor. */
export function methodNotAllowed(): Response {
  return jsonErr("METHOD_NOT_ALLOWED", "Método não permitido nesta API analítica.", 405);
}

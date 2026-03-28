import { jsonErr } from "@/lib/http";

/** Converte exceções de `requireRole` / `requireStaffWrite` em respostas JSON. */
export function authErrorResponse(e: unknown): Response | null {
  if (e instanceof Error && e.message === "UNAUTHENTICATED") {
    return jsonErr("UNAUTHENTICATED", "Sessão não encontrada.", 401);
  }
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }
  return null;
}

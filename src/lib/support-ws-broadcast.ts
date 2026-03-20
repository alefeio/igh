/**
 * Dispara o broadcast do badge de suporte via HTTP interna ao processo do servidor.
 * audience: "student" = só o aluno deve atualizar o badge (ex.: admin respondeu); "admin" = só admin (ex.: aluno respondeu); "all" = todos.
 */
const BROADCAST_PATH = "/__broadcast_support";

export function broadcastSupportBadgeUpdate(
  audience: "all" | "student" | "admin" = "all",
  forUserId?: string
): void {
  const port = process.env.PORT || "3000";
  const secret = process.env.SUPPORT_WS_BROADCAST_SECRET || "support-ws-broadcast-dev";
  const payload = JSON.stringify(
    forUserId ? { audience, forUserId } : { audience }
  );
  // Dispara no próximo tick para a resposta da API já ter sido enviada (evita bloqueio no mesmo processo).
  const run = () => {
    fetch(`http://127.0.0.1:${port}${BROADCAST_PATH}`, {
      method: "POST",
      headers: { "x-broadcast-secret": secret, "Content-Type": "application/json" },
      body: payload,
    }).catch(() => {});
  };
  if (typeof setImmediate !== "undefined") setImmediate(run);
  else setTimeout(run, 0);
}

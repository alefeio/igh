/**
 * Módulo compartilhado entre o servidor WebSocket e as API routes.
 * Mantém o Set de clientes conectados e envia broadcast quando o badge de suporte deve atualizar.
 * Uso: servidor customizado chama addClient/removeClient; API routes chamam broadcastSupportBadge().
 */
const clients = new Set();

function addClient(ws) {
  clients.add(ws);
}

function removeClient(ws) {
  clients.delete(ws);
}

/**
 * @param {"all"|"student"|"admin"} audience - "student" = só aluno deve atualizar; "admin" = só admin; "all" = todos
 * @param {string|undefined} forUserId - com audience "student": id do User dono do chamado (só esse cliente deve atualizar o badge)
 */
function broadcastSupportBadge(audience = "all", forUserId) {
  const payload = JSON.stringify({
    type: "support_badge",
    audience,
    ...(forUserId ? { forUserId } : {}),
  });
  clients.forEach((ws) => {
    if (ws.readyState === 1) {
      try {
        ws.send(payload);
      } catch (_) {}
    }
  });
}

module.exports = { addClient, removeClient, broadcastSupportBadge };

/**
 * Feedback das mutações do CMS do site.
 *
 * Só o Master grava direto no conteúdo público; Admin e Coordenador têm as alterações
 * enfileiradas em `PendingSiteChange`. Nesses casos a tela não pode afirmar que o conteúdo
 * já está publicado, senão o usuário recarrega a lista, vê os dados antigos e conclui que
 * o salvamento falhou.
 */

/** Envelope devolvido pelas rotas de escrita em `/api/admin/site/**`. */
export type SiteMutationResult<T> = Partial<T> & {
  pending?: boolean;
  message?: string;
};

export const PENDING_SITE_CHANGE_FALLBACK = "Alteração enviada para aprovação do Master.";

/**
 * Escolhe entre a mensagem de "aplicado" e a de "enviado para aprovação".
 *
 * @param appliedMessage mensagem exibida quando a alteração já valeu (Master).
 */
export function siteMutationMessage(
  data: { pending?: boolean; message?: string } | null | undefined,
  appliedMessage: string
): string {
  if (data?.pending) return data.message ?? PENDING_SITE_CHANGE_FALLBACK;
  return appliedMessage;
}

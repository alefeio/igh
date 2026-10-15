import "server-only";

/**
 * Links antigos de oferta de vaga não criam matrícula.
 * A inclusão na turma fica com o professor, na aba Lista de espera.
 */
export async function acceptWaitlistSeatOffer(rawToken: string): Promise<
  | { ok: true; enrollmentId: string; studentId: string; courseName: string }
  | { ok: false; code: string; message: string }
> {
  if (!rawToken.trim()) {
    return { ok: false, code: "invalid", message: "Link de oferta inválido." };
  }
  return {
    ok: false,
    code: "MANUAL",
    message: "A inclusão na turma é feita pelo professor, quando houver vaga.",
  };
}

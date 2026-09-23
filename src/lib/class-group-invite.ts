import { randomBytes } from "node:crypto";

/** Token URL-safe para o link público `/turma/[token]`. */
export function generateClassGroupInviteToken(): string {
  return randomBytes(18).toString("base64url");
}

export function classGroupInvitePublicPath(token: string): string {
  return `/turma/${encodeURIComponent(token)}`;
}

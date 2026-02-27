import "server-only";

import { randomBytes } from "crypto";

const LENGTH = 14;
const CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";

/**
 * Gera uma senha temporária forte. Não logar este valor.
 */
export function generateTempPassword(): string {
  const bytes = randomBytes(LENGTH);
  let result = "";
  for (let i = 0; i < LENGTH; i++) {
    result += CHARS[bytes[i]! % CHARS.length];
  }
  return result;
}

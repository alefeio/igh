import "server-only";

import { SignJWT, jwtVerify } from "jose";

const RECOVERY_KIND = "pwd_rec_v1";
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");

export type PasswordRecoveryStepPayload = {
  /** 1 = aluno/responsável identificado; 0 = fluxo inerte (anti-enumeração) */
  v: 0 | 1;
  uid: string;
  sid: string;
};

export async function signPasswordRecoveryStepToken(payload: PasswordRecoveryStepPayload, expiresIn = "15m"): Promise<string> {
  return new SignJWT({
    recoveryKind: RECOVERY_KIND,
    v: payload.v,
    uid: payload.uid,
    sid: payload.sid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

export async function verifyPasswordRecoveryStepToken(token: string): Promise<PasswordRecoveryStepPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.recoveryKind !== RECOVERY_KIND) return null;
    const v = payload.v === 1 ? 1 : 0;
    const uid = typeof payload.uid === "string" ? payload.uid : "";
    const sid = typeof payload.sid === "string" ? payload.sid : "";
    return { v, uid, sid };
  } catch {
    return null;
  }
}

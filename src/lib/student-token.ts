import { SignJWT, jwtVerify } from "jose";

const AUTH_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
const PRE_ENROLL_STUDENT_TOKEN_EXP = "1h";

export async function signStudentToken(studentId: string): Promise<string> {
  return new SignJWT({ studentId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(PRE_ENROLL_STUDENT_TOKEN_EXP)
    .sign(AUTH_SECRET);
}

export async function verifyStudentToken(token: string): Promise<{ studentId: string } | null> {
  try {
    const { payload } = await jwtVerify<{ studentId?: string }>(token, AUTH_SECRET);
    if (payload.studentId && typeof payload.studentId === "string") {
      return { studentId: payload.studentId };
    }
    return null;
  } catch {
    return null;
  }
}

import type { SessionUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/auth";

/** Leitura da área Diretor: apenas DIRECTOR ou MASTER (preview, sem impersonação). */
export async function requireDirectorRead(): Promise<
  SessionUser & { viewer: "DIRECTOR" | "MASTER" }
> {
  const user = await requireSessionUser();
  if (user.role === "DIRECTOR") return { ...user, viewer: "DIRECTOR" };
  if (user.role === "MASTER") return { ...user, viewer: "MASTER" };
  throw new Error("FORBIDDEN");
}

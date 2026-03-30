import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const MAX_PATH_LEN = 512;

/** Regista uma visita à rota atual (pathname). Chamado pelo cliente na área protegida. */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
  }

  let body: { path?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }

  const raw = typeof body.path === "string" ? body.path.trim() : "";
  if (!raw.startsWith("/")) {
    return jsonErr("VALIDATION_ERROR", "path deve começar com /.", 400);
  }
  /** Só pathname: sem query nem fragmento. */
  const pathOnly = raw.split("?")[0]?.split("#")[0] ?? "";
  if (!pathOnly.startsWith("/")) {
    return jsonErr("VALIDATION_ERROR", "path inválido.", 400);
  }
  const path = pathOnly.length > MAX_PATH_LEN ? pathOnly.slice(0, MAX_PATH_LEN) : pathOnly;

  await prisma.userPageVisit.create({
    data: {
      userId: user.id,
      path,
    },
  });

  return jsonOk({ recorded: true });
}

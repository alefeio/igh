import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Retorna as chaves dos tutoriais já concluídos pelo usuário logado. */
export async function GET(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { completedTutorialKeys: true },
  });
  if (!dbUser) {
    return jsonOk({ completedKeys: [] });
  }

  const key = new URL(request.url).searchParams.get("key");
  if (key) {
    const completed = dbUser.completedTutorialKeys.includes(key);
    return jsonOk({ completed, completedKeys: dbUser.completedTutorialKeys });
  }

  return jsonOk({ completedKeys: dbUser.completedTutorialKeys });
}

/** Marca um tutorial como concluído para o usuário logado. */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : null;
  if (!key || key.length === 0) {
    return jsonErr("VALIDATION_ERROR", "O campo key é obrigatório.", 400);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { completedTutorialKeys: true },
  });
  if (!dbUser) {
    return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
  }

  if (dbUser.completedTutorialKeys.includes(key)) {
    return jsonOk({ completedKeys: dbUser.completedTutorialKeys });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      completedTutorialKeys: { push: key },
    },
    select: { completedTutorialKeys: true },
  });

  return jsonOk({ completedKeys: updated.completedTutorialKeys });
}

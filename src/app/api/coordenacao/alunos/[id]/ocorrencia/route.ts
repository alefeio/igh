import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { ENROLLMENT_HISTORY_BODY_MAX, trimHistoryBody } from "@/lib/enrollment-history";
import { notifyEnrollmentHistoryEntry } from "@/lib/enrollment-history-notifications";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** Registra uma ocorrência no histórico da matrícula. Não altera o status. */
export async function POST(request: Request, context: Ctx) {
  let actor;
  try {
    actor = await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }

  const { id: enrollmentId } = await context.params;
  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? trimHistoryBody(body.body) : "";
  if (text.length < 2) return jsonErr("VALIDATION_ERROR", "Escreva a ocorrência.", 400);
  if (text.length > ENROLLMENT_HISTORY_BODY_MAX) return jsonErr("VALIDATION_ERROR", "Texto longo demais.", 400);

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const created = await prisma.enrollmentHistoryEntry.create({
    data: {
      enrollmentId,
      authorId: actor.id,
      kind: "OCORRENCIA",
      body: text,
    },
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  try {
    await notifyEnrollmentHistoryEntry(created.id);
  } catch (error) {
    console.error("[enrollment-history] notificação", error);
  }

  return jsonOk(
    {
      entry: {
        id: created.id,
        kind: created.kind,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
        authorName: created.author.name,
      },
    },
    { status: 201 },
  );
}

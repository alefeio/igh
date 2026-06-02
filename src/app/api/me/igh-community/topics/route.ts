import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  getStudentForCommunityUser,
  mapTopicRow,
  studentCanParticipateInCommunity,
} from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createIghCommunityTopicSchema } from "@/lib/validators/igh-community";

export async function GET(request: Request) {
  try {
    const user = await requireRole("STUDENT");
    const student = await getStudentForCommunityUser(user.id);
    if (!student) return jsonErr("NOT_FOUND", "Perfil de aluno não encontrado.", 404);

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const mine = searchParams.get("mine") === "1";

    const topics = await prisma.ighCommunityTopic.findMany({
      where: {
        ...(kind && ["IDEA", "TEAM", "DISCUSSION"].includes(kind)
          ? { kind: kind as "IDEA" | "TEAM" | "DISCUSSION" }
          : {}),
        ...(mine
          ? { studentId: student.id }
          : {
              OR: [{ status: "APPROVED" }, { studentId: student.id, status: { in: ["PENDING", "REJECTED"] } }],
            }),
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        student: { select: { name: true } },
        replies: {
          where: {
            OR: [{ status: "APPROVED" }, { studentId: student.id }],
          },
          select: { id: true },
        },
      },
      take: 100,
    });

    return jsonOk({
      canParticipate: await studentCanParticipateInCommunity(student.id),
      topics: topics.map((t) =>
        mapTopicRow({ ...t, _count: { replies: t.replies.length } }, student.id)
      ),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("STUDENT");
    const student = await getStudentForCommunityUser(user.id);
    if (!student) return jsonErr("NOT_FOUND", "Perfil de aluno não encontrado.", 404);

    if (!(await studentCanParticipateInCommunity(student.id))) {
      return jsonErr("FORBIDDEN", "É necessário ter matrícula ativa para publicar na comunidade.", 403);
    }

    const body = await request.json().catch(() => null);
    const parsed = createIghCommunityTopicSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    }

    const topic = await prisma.ighCommunityTopic.create({
      data: {
        studentId: student.id,
        kind: parsed.data.kind,
        title: parsed.data.title,
        content: parsed.data.content,
        status: "PENDING",
      },
      include: { student: { select: { name: true } }, replies: { select: { id: true } } },
    });

    return jsonOk(
      {
        topic: mapTopicRow({ ...topic, _count: { replies: topic.replies.length } }, student.id),
        message:
          "Sua publicação foi enviada e aguarda moderação. Você será notificado quando for aprovada.",
      },
      { status: 201 }
    );
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

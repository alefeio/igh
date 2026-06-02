import "server-only";

import type { IghCommunityPostStatus, IghCommunityTopicKind } from "@/generated/prisma/client";
import type { CommunityTopicView } from "@/lib/igh-community-types";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

export type { CommunityTopicView } from "@/lib/igh-community-types";

export const IGH_COMMUNITY_TOPIC_KIND_LABELS: Record<IghCommunityTopicKind, string> = {
  IDEA: "Ideia de projeto",
  TEAM: "Equipe / parceria",
  DISCUSSION: "Discussão geral",
};

export const IGH_COMMUNITY_STATUS_LABELS: Record<IghCommunityPostStatus, string> = {
  PENDING: "Aguardando moderação",
  APPROVED: "Publicado",
  REJECTED: "Não publicado",
};

export async function getStudentForCommunityUser(userId: string) {
  return prisma.student.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, name: true },
  });
}

/** Aluno com ao menos uma matrícula ativa pode participar da comunidade. */
export async function studentCanParticipateInCommunity(studentId: string): Promise<boolean> {
  const count = await prisma.enrollment.count({
    where: { studentId, status: "ACTIVE" },
  });
  return count > 0;
}

export function isCommunityModerator(user: SessionUser): boolean {
  return ["MASTER", "ADMIN", "COORDINATOR"].includes(user.role);
}

export function canReadCommunity(user: SessionUser): boolean {
  return (
    user.role === "STUDENT" ||
    isCommunityModerator(user) ||
    user.role === "TEACHER"
  );
}

export function mapTopicRow(
  row: {
    id: string;
    kind: IghCommunityTopicKind;
    title: string;
    content: string;
    status: IghCommunityPostStatus;
    studentId: string;
    createdAt: Date;
    updatedAt: Date;
    student: { name: string };
    _count?: { replies: number };
  },
  viewerStudentId: string | null
): CommunityTopicView {
  return {
    id: row.id,
    kind: row.kind,
    kindLabel: IGH_COMMUNITY_TOPIC_KIND_LABELS[row.kind],
    title: row.title,
    content: row.content,
    status: row.status,
    statusLabel: IGH_COMMUNITY_STATUS_LABELS[row.status],
    authorName: row.student.name,
    authorStudentId: row.studentId,
    isOwn: viewerStudentId === row.studentId,
    replyCount: row._count?.replies ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

import "server-only";

import type { IghCommunityPostStatus, IghCommunityTopicKind } from "@/generated/prisma/client";
import type { CommunityAuthorRole, CommunityReplyView, CommunityTopicView } from "@/lib/igh-community-types";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

export type { CommunityTopicView, CommunityReplyView } from "@/lib/igh-community-types";

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

const AUTHOR_ROLE_LABELS: Record<CommunityAuthorRole, string> = {
  STUDENT: "Aluno",
  TEACHER: "Professor",
  STAFF: "Equipe IGH",
};

export function normalizeCommunityTagName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

export function authorRoleFromUserRole(role: SessionUser["role"]): CommunityAuthorRole {
  if (role === "TEACHER") return "TEACHER";
  if (role === "STUDENT") return "STUDENT";
  return "STAFF";
}

export function authorRoleLabel(role: CommunityAuthorRole): string {
  return AUTHOR_ROLE_LABELS[role];
}

export async function getStudentForCommunityUser(userId: string) {
  return prisma.student.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, name: true },
  });
}

/** Qualquer usuário ativo com perfil de aluno no portal pode participar (matrícula não é obrigatória). */
export function userCanParticipateInCommunity(user: SessionUser): boolean {
  return user.role === "STUDENT" && user.isActive;
}

export function userCanReplyAsStaff(user: SessionUser): boolean {
  return ["MASTER", "ADMIN", "COORDINATOR", "TEACHER"].includes(user.role) && user.isActive;
}

export function isCommunityModerator(user: SessionUser): boolean {
  return ["MASTER", "ADMIN", "COORDINATOR"].includes(user.role);
}

export function canReadCommunity(user: SessionUser): boolean {
  return userCanParticipateInCommunity(user) || userCanReplyAsStaff(user) || isCommunityModerator(user);
}

export async function upsertCommunityTags(tagNames: string[]) {
  const unique = [...new Set(tagNames.map(normalizeCommunityTagName).filter((t) => t.length >= 2))].slice(0, 8);
  const tags = await Promise.all(
    unique.map((name) =>
      prisma.ighCommunityTag.upsert({
        where: { name },
        create: { name },
        update: {},
        select: { id: true, name: true },
      })
    )
  );
  return tags;
}

export function mapTopicRow(
  row: {
    id: string;
    kind: IghCommunityTopicKind;
    title: string;
    content: string;
    status: IghCommunityPostStatus;
    authorUserId: string;
    studentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    author: { name: string; role: SessionUser["role"] };
    tags?: { tag: { name: string } }[];
    _count?: { replies: number };
  },
  viewerUserId: string | null
): CommunityTopicView {
  const authorRole = authorRoleFromUserRole(row.author.role);
  return {
    id: row.id,
    kind: row.kind,
    kindLabel: IGH_COMMUNITY_TOPIC_KIND_LABELS[row.kind],
    title: row.title,
    content: row.content,
    status: row.status,
    statusLabel: IGH_COMMUNITY_STATUS_LABELS[row.status],
    authorName: row.author.name,
    authorUserId: row.authorUserId,
    authorRole,
    authorRoleLabel: authorRoleLabel(authorRole),
    authorStudentId: row.studentId,
    isOwn: viewerUserId === row.authorUserId,
    replyCount: row._count?.replies ?? 0,
    tags: row.tags?.map((t) => t.tag.name) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapReplyRow(
  row: {
    id: string;
    content: string;
    status: IghCommunityPostStatus;
    authorUserId: string;
    studentId: string | null;
    createdAt: Date;
    author: { name: string; role: SessionUser["role"] };
  },
  viewerUserId: string | null
): CommunityReplyView {
  const authorRole = authorRoleFromUserRole(row.author.role);
  return {
    id: row.id,
    content: row.content,
    status: row.status,
    statusLabel: IGH_COMMUNITY_STATUS_LABELS[row.status],
    authorName: row.author.name,
    authorUserId: row.authorUserId,
    authorRole,
    authorRoleLabel: authorRoleLabel(authorRole),
    authorStudentId: row.studentId,
    isOwn: viewerUserId === row.authorUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

export const topicInclude = {
  author: { select: { name: true, role: true } },
  tags: { include: { tag: { select: { name: true } } } },
} as const;

export const replyInclude = {
  author: { select: { name: true, role: true } },
} as const;

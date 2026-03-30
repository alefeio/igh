import "server-only";

import { buildStudentBadgeContextFromStudentId } from "@/lib/student-badge-context";
import { getAllUnlockedBadges, type StudentBadgeContext } from "@/lib/student-badge-definitions";
import { getGamificationSnapshotForStudent } from "@/lib/student-gamification-ranking";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

export type MilestoneSnapshot = {
  badgeCtx: StudentBadgeContext | null;
  gam: { points: number; levelName: string } | null;
};

export async function captureMilestoneSnapshot(studentId: string): Promise<MilestoneSnapshot> {
  const [badgeCtx, gam] = await Promise.all([
    buildStudentBadgeContextFromStudentId(studentId),
    getGamificationSnapshotForStudent(studentId),
  ]);
  return {
    badgeCtx,
    gam: gam ? { points: gam.points, levelName: gam.levelName } : null,
  };
}

/** Compara antes/depois de uma ação (aula, exercício, fórum) e notifica nível/conquistas novos. */
export async function notifyMilestoneDiff(studentId: string, before: MilestoneSnapshot): Promise<void> {
  const [afterBadgeCtx, afterGam] = await Promise.all([
    buildStudentBadgeContextFromStudentId(studentId),
    getGamificationSnapshotForStudent(studentId),
  ]);
  if (!afterGam || !afterBadgeCtx) return;
  const userId = afterGam.userId;

  if (before.gam && before.gam.levelName !== afterGam.levelName) {
    await createUserNotificationIfNew({
      userId,
      kind: "LEVEL_UP",
      title: `Novo nível: ${afterGam.levelName}`,
      body: `Você alcançou o nível ${afterGam.levelName} (${afterGam.points} pontos).`,
      linkUrl: "/dashboard",
      dedupeKey: `level:${userId}:${afterGam.levelName}`,
    });
  }

  const beforeIds = new Set(
    before.badgeCtx ? getAllUnlockedBadges(before.badgeCtx).map((b) => b.id) : []
  );
  const afterBadges = getAllUnlockedBadges(afterBadgeCtx);
  for (const b of afterBadges) {
    if (!beforeIds.has(b.id)) {
      await createUserNotificationIfNew({
        userId,
        kind: "ACHIEVEMENT_UNLOCKED",
        title: "Nova conquista",
        body: `"${b.label}" desbloqueada.`,
        linkUrl: "/dashboard",
        dedupeKey: `achievement:${userId}:${b.id}`,
      });
    }
  }
}

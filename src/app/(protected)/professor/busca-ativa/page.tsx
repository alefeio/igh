import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { prisma } from "@/lib/prisma";

export default async function BuscaAtivaLegacyPage({
  searchParams,
}: {
  searchParams: Promise<{ classGroupId?: string; mode?: string; enrollmentId?: string }>;
}) {
  const user = await requireSessionUser();
  if (user.role !== "TEACHER") redirect("/dashboard");
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) redirect("/dashboard");
  const { classGroupId, mode, enrollmentId } = await searchParams;
  if (classGroupId) {
    const group = await prisma.classGroup.findFirst({
      where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
      select: { id: true },
    });
    if (group) {
      const query = new URLSearchParams({ aba: "busca-ativa" });
      if (mode === "turma") query.set("mode", "turma");
      if (enrollmentId) query.set("enrollmentId", enrollmentId);
      redirect(`/professor/turmas/${encodeURIComponent(group.id)}?${query}`);
    }
  }
  redirect("/professor/turmas?buscaAtiva=abrirTurma");
}

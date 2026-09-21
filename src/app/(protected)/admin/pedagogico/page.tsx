import { notFound } from "next/navigation";

import { PedagogicalDashboardClient } from "@/components/dashboard/PedagogicalDashboardClient";
import { requireSessionUser } from "@/lib/auth";

export const metadata = {
  title: "Dashboard pedagógico",
  description: "Resumo de ciclos, turmas, alunos, frequência e formados.",
};

export default async function AdminPedagogicoDashboardPage() {
  const user = await requireSessionUser();
  if (user.role !== "ADMIN" && user.role !== "MASTER" && user.role !== "GENERAL_ADMIN") {
    notFound();
  }

  return <PedagogicalDashboardClient />;
}

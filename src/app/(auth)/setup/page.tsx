import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const usersCount = await prisma.user.count();
  if (usersCount > 0) {
    redirect("/login");
  }

  return (
    <div className="w-full max-w-md px-2 sm:px-0">
      <div className="card w-full">
        <div className="card-header">
          <div className="text-lg font-semibold">Configurar usuário MASTER</div>
          <div className="mt-1 text-sm text-zinc-600">
            Primeiro acesso: crie o usuário MASTER do sistema.
          </div>
        </div>
        <div className="card-body">
          <SetupForm />
        </div>
      </div>
    </div>
  );
}

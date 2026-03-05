"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";

export default function EscolherPerfilPage() {
  const user = useUser();
  const router = useRouter();

  const canAdmin = user.isAdmin === true;
  const canStudent = user.role === "STUDENT";
  const canTeacher = user.role === "TEACHER";

  if (!canAdmin && !canStudent && !canTeacher) {
    router.replace("/dashboard");
    return null;
  }

  async function enterAs(role: "STUDENT" | "TEACHER" | "ADMIN") {
    if (role === "ADMIN") {
      const res = await fetch("/api/auth/choose-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "ADMIN" }),
      });
      if (!res.ok) return;
    }
    router.replace("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Como deseja acessar o sistema?
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Escolha o perfil com o qual deseja entrar nesta sessão.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {canStudent && (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => enterAs("STUDENT")}
            >
              Entrar como Aluno
            </Button>
          )}
          {canTeacher && (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => enterAs("TEACHER")}
            >
              Entrar como Professor
            </Button>
          )}
          {canAdmin && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => enterAs("ADMIN")}
            >
              Entrar como Admin
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

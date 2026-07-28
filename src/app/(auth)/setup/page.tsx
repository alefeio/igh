import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  let usersCount: number | null = null;
  let dbError: string | null = null;

  try {
    usersCount = await prisma.user.count();
  } catch (e) {
    console.error("[setup] falha ao consultar usuários:", e);
    const msg = e instanceof Error ? e.message : String(e);
    const missingTable =
      /does not exist|P2021|relation .* does not exist/i.test(msg) ||
      /no such table/i.test(msg);
    const missingUrl = /URL de banco não configurada/i.test(msg);
    dbError = missingUrl
      ? "O banco de dados não está configurado neste ambiente (variável APP_DATABASE_URL ou DATABASE_URL)."
      : missingTable
        ? "O banco existe, mas as migrations ainda não foram aplicadas. No projeto Vercel, rode as migrations (prisma migrate deploy) com a URL deste ambiente."
        : "Não foi possível conectar ao banco de dados. Verifique as variáveis de ambiente e os logs do servidor.";
  }

  if (usersCount != null && usersCount > 0) {
    redirect("/login");
  }

  if (dbError) {
    return (
      <div className="w-full max-w-md px-2 sm:px-0">
        <div className="card w-full">
          <div className="card-header">
            <div className="text-lg font-semibold text-[var(--text-primary)]">Setup indisponível</div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">
              Não é possível criar o usuário MASTER agora.
            </div>
          </div>
          <div className="card-body space-y-4">
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{dbError}</p>
            <p className="text-xs text-[var(--text-muted)]">
              Em um deploy novo (ex.: INAC), confirme no painel da Vercel se o projeto tem a URL do{" "}
              <strong>próprio</strong> banco e se o build/release executou <code>prisma migrate deploy</code>.
            </p>
            <Link
              href="/login"
              className="inline-flex text-sm font-semibold text-[var(--igh-primary)] underline"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    );
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

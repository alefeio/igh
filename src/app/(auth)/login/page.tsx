import { redirect } from "next/navigation";
import Link from "next/link";

import { getSessionUserFromCookie } from "@/lib/auth";
import { getTurnstileSiteKey } from "@/lib/bot-protection";
import { LoginForm } from "./login-form";

type Props = { searchParams: Promise<{ from?: string | string[] }> };

function normalizeRedirectFrom(from: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(from) ? from[0] : from;
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;
}

export default async function LoginPage({ searchParams }: Props) {
  const session = await getSessionUserFromCookie();
  const { from } = await searchParams;
  const redirectTo = normalizeRedirectFrom(from);
  if (session) {
    redirect(redirectTo ?? "/dashboard");
  }

  return (
    <div className="w-full max-w-md px-2 sm:px-0">
      <div className="mb-4 flex justify-center sm:mb-6">
        <img src="/images/logo.png" alt="Logo" className="h-16 w-auto object-contain sm:h-20" />
      </div>
      <div className="card w-full">
        <div className="card-header">
          <div className="text-lg font-semibold text-[var(--text-primary)]">Entrar</div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">Acesse com seu e-mail e senha.</div>
        </div>
        <div className="card-body">
          <LoginForm redirectTo={redirectTo} turnstileSiteKey={getTurnstileSiteKey()} />
          <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
            Ainda não tem conta?{" "}
            <Link href={redirectTo ? `/cadastro?from=${encodeURIComponent(redirectTo)}` : "/cadastro"} className="underline">
              Criar cadastro rápido
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

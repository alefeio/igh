import { redirect } from "next/navigation";

import { getSessionUserFromCookie } from "@/lib/auth";
import { LoginForm } from "./login-form";

type Props = { searchParams: Promise<{ from?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const session = await getSessionUserFromCookie();
  const { from } = await searchParams;
  if (session) {
    const path = from && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
    redirect(path);
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
          <LoginForm redirectTo={from} />
        </div>
      </div>
    </div>
  );
}

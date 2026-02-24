import { redirect } from "next/navigation";

import { getSessionUserFromCookie } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSessionUserFromCookie();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <div className="card-header">
          <div className="text-lg font-semibold">Entrar</div>
          <div className="mt-1 text-sm text-zinc-600">Acesse com seu e-mail e senha.</div>
        </div>
        <div className="card-body">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

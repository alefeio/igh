import { redirect } from "next/navigation";

import { getSessionUserFromCookie } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSessionUserFromCookie();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="w-full max-w-md px-2 sm:px-0">
      <div className="mb-4 flex justify-center sm:mb-6">
        <img src="/images/logo.png" alt="Logo" className="h-16 w-auto object-contain sm:h-20" />
      </div>
      <div className="card w-full">
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

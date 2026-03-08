import { redirect } from "next/navigation";
import { getSessionUserFromCookie } from "@/lib/auth";
import { MeusDadosForm } from "./MeusDadosForm";

export const metadata = {
  title: "Meus dados",
  description: "Complete seu cadastro e anexe documento e comprovante de residência.",
};

export default async function MeusDadosPage() {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "STUDENT") {
    redirect("/login");
  }
  return (
    <div className="container-page flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Meus dados
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Complete seu cadastro com os dados restantes e anexe documento de identidade e comprovante de residência.
        </p>
      </header>
      <MeusDadosForm />
    </div>
  );
}

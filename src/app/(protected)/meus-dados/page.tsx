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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Meus dados</h1>
        <p className="text-sm text-zinc-600">
          Complete seu cadastro com os dados restantes e anexe documento de identidade e comprovante de residência.
        </p>
      </div>
      <MeusDadosForm />
    </div>
  );
}

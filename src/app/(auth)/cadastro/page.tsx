import { redirect } from "next/navigation";

import { getSessionUserFromCookie } from "@/lib/auth";
import { getTurnstileSiteKey } from "@/lib/bot-protection";
import { getSiteSettings } from "@/lib/site-data";
import { CadastroForm } from "./cadastro-form";

type Props = { searchParams: Promise<{ from?: string | string[] }> };

function normalizeRedirectFrom(from: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(from) ? from[0] : from;
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;
}

export default async function CadastroPage({ searchParams }: Props) {
  const session = await getSessionUserFromCookie();
  const { from } = await searchParams;
  const redirectTo = normalizeRedirectFrom(from);
  if (session) {
    redirect(redirectTo ?? "/dashboard");
  }

  const settings = await getSiteSettings();
  const logoSrc = settings?.logoUrl?.trim() || "/images/logo.png";
  const logoAlt = settings?.siteName?.trim() || "Logo";

  return (
    <div className="w-full max-w-md px-2 sm:px-0">
      <div className="mb-4 flex justify-center sm:mb-6">
        <img src={logoSrc} alt={logoAlt} className="h-16 w-auto object-contain sm:h-20" />
      </div>
      <div className="card w-full">
        <div className="card-header">
          <div className="text-lg font-semibold text-[var(--text-primary)]">Cadastro rápido</div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">
            Crie sua conta no site e vá direto para enviar sua homenagem.
          </div>
        </div>
        <div className="card-body">
          <CadastroForm redirectTo={redirectTo} turnstileSiteKey={getTurnstileSiteKey()} />
        </div>
      </div>
    </div>
  );
}

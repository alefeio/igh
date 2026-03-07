import { PageHeader, Section, Card } from "@/components/site";
import { SocialIcons } from "@/components/site/SocialIcons";
import { getSiteSettings, getContatoPageForSite } from "@/lib/site-data";
import { ContatoForm } from "./ContatoForm";

function normalizeAddresses(value: unknown): { line: string; city: string; state: string; zip: string }[] {
  if (!value || !Array.isArray(value)) return [];
  return value
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .map((x) => ({
      line: typeof x.line === "string" ? x.line : "",
      city: typeof x.city === "string" ? x.city : "",
      state: typeof x.state === "string" ? x.state : "",
      zip: typeof x.zip === "string" ? x.zip : "",
    }));
}

function formatAddress(a: { line: string; city: string; state: string; zip: string }): string {
  return [a.line, a.city, a.state, a.zip].filter(Boolean).join(", ");
}

export default async function ContatoPage() {
  const [settings, contatoPage] = await Promise.all([getSiteSettings(), getContatoPageForSite()]);
  const addresses = normalizeAddresses(settings?.addresses);
  const headerTitle = contatoPage?.title?.trim() || "Contato";
  const headerSubtitle = contatoPage?.subtitle?.trim() || "Envie sua mensagem ou inscreva-se nas formações.";
  const headerImageUrl = contatoPage?.headerImageUrl?.trim() || null;
  const firstAddressLine = addresses.length > 0 ? formatAddress(addresses[0]) : null;

  const whatsappNumber = settings?.contactWhatsapp?.replace(/\D/g, "") || "";
  const whatsappHref = whatsappNumber.length >= 10 ? `https://wa.me/${whatsappNumber.startsWith("55") ? whatsappNumber : "55" + whatsappNumber}` : "";

  const socials = [
    { name: "Instagram", href: settings?.socialInstagram ?? "", icon: "instagram" as const },
    { name: "Facebook", href: settings?.socialFacebook ?? "", icon: "facebook" as const },
    { name: "LinkedIn", href: settings?.socialLinkedin ?? "", icon: "linkedin" as const },
    { name: "Youtube", href: settings?.socialYoutube ?? "", icon: "youtube" as const },
    { name: "WhatsApp", href: whatsappHref, icon: "whatsapp" as const },
  ].filter((s) => s.href && s.href !== "#");

  const mapQuery = firstAddressLine ? encodeURIComponent(firstAddressLine) : null;
  const googleMapsUrl = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${mapQuery}` : null;
  const osmUrl = mapQuery ? `https://www.openstreetmap.org/search?query=${mapQuery}` : null;

  return (
    <>
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        backgroundImageUrl={headerImageUrl}
      />
      <Section id="inscreva">
        <div className="grid gap-8 lg:grid-cols-3">
          <ContatoForm />
          <div className="space-y-4">
            {(addresses.length > 0 || settings?.businessHours || socials.length > 0) && (
              <>
                {addresses.length > 0 && (
                  <Card>
                    <h3 className="font-semibold text-[var(--igh-secondary)]">Endereço{addresses.length > 1 ? "s" : ""}</h3>
                    <div className="mt-2 space-y-1 text-sm text-[var(--igh-muted)]">
                      {addresses.map((a, i) => (
                        <p key={i}>{formatAddress(a)}</p>
                      ))}
                    </div>
                  </Card>
                )}
                {settings?.businessHours && (
                  <Card>
                    <h3 className="font-semibold text-[var(--igh-secondary)]">Horários</h3>
                    <p className="mt-2 text-sm text-[var(--igh-muted)]">{settings.businessHours}</p>
                  </Card>
                )}
                {socials.length > 0 && (
                  <Card>
                    <h3 className="font-semibold text-[var(--igh-secondary)]">Redes sociais</h3>
                    <div className="mt-2">
                      <SocialIcons items={socials} iconClassName="h-6 w-6" />
                    </div>
                  </Card>
                )}
              </>
            )}
            {firstAddressLine ? (
              <div className="overflow-hidden rounded-lg border border-[var(--igh-border)]">
                <iframe
                  title="Mapa do primeiro endereço"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(firstAddressLine)}&output=embed`}
                  className="h-64 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="flex flex-wrap gap-3 border-t border-[var(--igh-border)] bg-[var(--igh-surface)] p-2">
                  {googleMapsUrl && (
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
                      Abrir no Google Maps
                    </a>
                  )}
                  {osmUrl && (
                    <a href={osmUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
                      Abrir no OpenStreetMap
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-[var(--igh-surface)] text-sm text-[var(--igh-muted)]">
                Cadastre um endereço em Configurações para exibir o mapa.
              </div>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}

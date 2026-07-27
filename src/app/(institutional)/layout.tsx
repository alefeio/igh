import { CookieConsentBanner, Navbar, Footer, FloatingChatWidget } from "@/components/site";
import { getSessionUserFromCookie } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { getMenuItems, getSiteSettings } from "@/lib/site-data";

function absoluteUrl(pathOrUrl: string, baseUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const base = baseUrl.replace(/\/$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

function resolveBaseUrl(): string {
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) return app.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "";
}

export async function generateMetadata() {
  const settings = await getSiteSettings();
  const siteName = settings?.siteName ?? BRAND.shortName;
  const title = settings?.seoTitleDefault ?? BRAND.seoTitle;
  const description = settings?.seoDescriptionDefault ?? BRAND.seoDescription;
  const baseUrl = resolveBaseUrl();

  const openGraph: { title: string; description: string; images?: { url: string; width?: number; height?: number; alt?: string }[] } = {
    title: settings?.seoTitleDefault ?? BRAND.legalName,
    description,
  };
  const logoUrl = settings?.logoUrl?.trim();
  if (logoUrl) {
    const imageUrl = logoUrl.startsWith("http") ? logoUrl : (baseUrl ? absoluteUrl(logoUrl, baseUrl) : null);
    if (imageUrl) {
      openGraph.images = [{ url: imageUrl, width: 1200, height: 630, alt: siteName }];
    }
  }

  return {
    title: {
      default: title,
      template: `%s | ${siteName}`,
    },
    description,
    openGraph,
    twitter: { card: "summary_large_image", title: openGraph.title, description: openGraph.description },
  };
}

export default async function InstitutionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuItems, settings, sessionUser] = await Promise.all([
    getMenuItems(),
    getSiteSettings(),
    getSessionUserFromCookie(),
  ]);

  const cssVars: string[] = [];
  if (settings?.primaryColor) {
    cssVars.push(`--igh-primary: ${settings.primaryColor}`);
    cssVars.push(`--igh-primary-hover: ${settings.primaryColor}`);
  }
  if (settings?.secondaryColor) {
    cssVars.push(`--igh-secondary: ${settings.secondaryColor}`);
    cssVars.push(`--igh-secondary-solid: ${settings.secondaryColor}`);
  }
  const styleContent = cssVars.length > 0 ? `:root { ${cssVars.join("; ")} }` : "";

  return (
    <>
      {styleContent ? <style dangerouslySetInnerHTML={{ __html: styleContent }} /> : null}
      <Navbar menuItems={menuItems} settings={settings} sessionUser={sessionUser} />
      <main id="main-content" className="min-h-[50vh]" style={{ background: "var(--background)" }}>{children}</main>
      <Footer menuItems={menuItems} settings={settings} />
      <FloatingChatWidget contactWhatsapp={settings?.contactWhatsapp} />
      <CookieConsentBanner />
    </>
  );
}

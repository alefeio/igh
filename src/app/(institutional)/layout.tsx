import { Navbar, Footer, FloatingChatWidget } from "@/components/site";
import { getSessionUserFromCookie } from "@/lib/auth";
import { getMenuItems, getSiteSettings } from "@/lib/site-data";

function absoluteUrl(pathOrUrl: string, baseUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const base = baseUrl.replace(/\/$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

export async function generateMetadata() {
  const settings = await getSiteSettings();
  const siteName = settings?.siteName ?? "IGH";
  const defaultTitle = "Instituto Gustavo Hessel | Formação em tecnologia e inclusão digital";
  const defaultDescription = "Formações gratuitas em programação, dados, UX/UI e mais. Inclusão digital e recondicionamento de computadores.";
  const title = settings?.seoTitleDefault ?? defaultTitle;
  const description = settings?.seoDescriptionDefault ?? defaultDescription;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";

  const openGraph: { title: string; description: string; images?: { url: string; width?: number; height?: number; alt?: string }[] } = {
    title: settings?.seoTitleDefault ?? "Instituto Gustavo Hessel",
    description: settings?.seoDescriptionDefault ?? defaultDescription,
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
    </>
  );
}

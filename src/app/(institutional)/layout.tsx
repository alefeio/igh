import { Navbar } from "@/components/site";
import { Footer } from "@/components/site";
import { getMenuItems, getSiteSettings } from "@/lib/site-data";

export async function generateMetadata() {
  const settings = await getSiteSettings();
  return {
    title: {
      default: settings?.seoTitleDefault ?? "Instituto Gustavo Hessel | Formação em tecnologia e inclusão digital",
      template: `%s | ${settings?.siteName ?? "IGH"}`,
    },
    description: settings?.seoDescriptionDefault ?? "Formações gratuitas em programação, dados, UX/UI e mais. Inclusão digital e recondicionamento de computadores.",
    openGraph: {
      title: settings?.seoTitleDefault ?? "Instituto Gustavo Hessel",
      description: settings?.seoDescriptionDefault ?? "Formações gratuitas em programação, dados, UX/UI e mais.",
    },
  };
}

export default async function InstitutionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuItems, settings] = await Promise.all([
    getMenuItems(),
    getSiteSettings(),
  ]);

  const cssVars: string[] = [];
  if (settings?.primaryColor) {
    cssVars.push(`--igh-primary: ${settings.primaryColor}`);
    cssVars.push(`--igh-primary-hover: ${settings.primaryColor}`);
  }
  if (settings?.secondaryColor) {
    cssVars.push(`--igh-secondary: ${settings.secondaryColor}`);
  }
  const styleContent = cssVars.length > 0 ? `:root { ${cssVars.join("; ")} }` : "";

  return (
    <>
      {styleContent ? <style dangerouslySetInnerHTML={{ __html: styleContent }} /> : null}
      <Navbar menuItems={menuItems} settings={settings} />
      <main id="main-content">{children}</main>
      <Footer menuItems={menuItems} settings={settings} />
    </>
  );
}

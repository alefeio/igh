import { Navbar } from "@/components/site";
import { Footer } from "@/components/site";
import { getMenuItems, getSiteSettings } from "@/lib/site-data";

export default async function InstitutionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuItems, settings] = await Promise.all([
    getMenuItems(),
    getSiteSettings(),
  ]);
  return (
    <>
      <Navbar menuItems={menuItems} />
      <main id="main-content">{children}</main>
      <Footer menuItems={menuItems} settings={settings} />
    </>
  );
}

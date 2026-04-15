import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { getSiteSettings } from "@/lib/site-data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultTitle = "Painel";
const defaultDescription = "Sistema de cadastro de cursos, turmas e professores.";

function metadataBaseUrl(): URL | undefined {
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) {
    try {
      const normalized = app.replace(/\/$/, "");
      return new URL(`${normalized}/`);
    } catch {
      /* ignore */
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    try {
      return new URL(`https://${vercel.replace(/^https?:\/\//, "")}/`);
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

// Fallback quando não houver favicon no banco (ou DB indisponível):
// - Prioriza PNG em /public/images/favicon.png (o browser tende a preferir .png/.ico).
// - Mantém SVG como alternativa.
const fallbackFavicon = {
  icon: [
    { url: "/images/favicon.png", type: "image/png" },
    { url: "/images/favicon.svg", type: "image/svg+xml" },
  ],
  shortcut: ["/images/favicon.png", "/images/favicon.svg"],
  apple: [
    { url: "/images/favicon.png", type: "image/png" },
    { url: "/images/favicon.svg", type: "image/svg+xml" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = settings?.seoTitleDefault ?? defaultTitle;
  const description = settings?.seoDescriptionDefault ?? defaultDescription;
  const faviconUrl = settings?.faviconUrl?.trim() || undefined;

  return {
    metadataBase: metadataBaseUrl(),
    title,
    description,
    icons: faviconUrl
      ? {
          icon: [{ url: faviconUrl }],
          shortcut: [faviconUrl],
          apple: [{ url: faviconUrl }],
        }
      : fallbackFavicon,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ThemeScript />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}

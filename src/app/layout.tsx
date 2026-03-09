import type { Metadata, Viewport } from "next";
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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = settings?.seoTitleDefault ?? defaultTitle;
  const description = settings?.seoDescriptionDefault ?? defaultDescription;
  const faviconUrl = settings?.faviconUrl?.trim() || undefined;

  return {
    title,
    description,
    icons: faviconUrl
      ? {
          icon: [{ url: faviconUrl, type: "image/png" }, { url: faviconUrl, type: "image/x-icon" }],
          shortcut: [faviconUrl],
          apple: [faviconUrl],
        }
      : {
          icon: [
            { url: "/images/favicon.ico", type: "image/x-icon" },
            { url: "/images/favicon.png", type: "image/png" },
          ],
          shortcut: ["/images/favicon.ico"],
          apple: [{ url: "/images/favicon.png", type: "image/png" }],
        },
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
      </body>
    </html>
  );
}

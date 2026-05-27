import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/contexts/I18nContext";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Wazo Digital",
  description: "Digitalisez votre micro-entreprise en Afrique",
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wazo Digital",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#075E54",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <I18nProvider>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}

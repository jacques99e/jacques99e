import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/contexts/I18nContext";
import { Providers } from "@/components/Providers";
import { buildRootMetadata } from "@/lib/seo";

export const metadata: Metadata = buildRootMetadata();

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

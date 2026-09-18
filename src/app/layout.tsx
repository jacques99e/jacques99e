import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/contexts/I18nContext";
import { MetaPixel } from "@/components/MetaPixel";
import { Providers } from "@/components/Providers";
import { buildRootMetadata } from "@/lib/seo";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-wazo",
});

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
    <html lang="fr" className={plusJakarta.variable}>
      <body className={`${plusJakarta.className} min-h-screen`}>
        <Script id="wazo-pwa-unstick" strategy="beforeInteractive">
          {`try{if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});});}if("caches" in window){caches.keys().then(function(keys){keys.forEach(function(name){caches.delete(name);});});}}catch(e){}`}
        </Script>
        <I18nProvider>
          <MetaPixel />
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}

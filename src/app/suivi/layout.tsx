import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata(
  "Suivi colis",
  "Suivez votre livraison Wazo Digital en temps réel avec le code reçu par SMS ou WhatsApp.",
  "/suivi"
);

export default function SuiviLayout({ children }: { children: React.ReactNode }) {
  return children;
}

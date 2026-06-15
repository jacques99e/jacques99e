import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata(
  "Traçabilité produit",
  "Vérifiez l'authenticité d'un produit enregistré sur la blockchain Wazo Digital.",
  "/trace"
);

export default function TraceLayout({ children }: { children: React.ReactNode }) {
  return children;
}

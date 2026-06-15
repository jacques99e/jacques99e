import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata(
  "Formation en ligne",
  "Accédez à votre cours Wazo Digital avec le code reçu par WhatsApp ou de votre formateur.",
  "/formation"
);

export default function FormationLayout({ children }: { children: React.ReactNode }) {
  return children;
}

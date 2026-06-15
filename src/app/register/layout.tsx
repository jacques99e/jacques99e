import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = noIndexMetadata("Inscription");

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

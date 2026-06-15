import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = noIndexMetadata("Configuration boutique");

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}

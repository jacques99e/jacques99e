import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { resolveLandingUrl } from "@/lib/public-urls";

export function StorefrontNotFound() {
  const landingUrl = resolveLandingUrl();

  return (
    <div className="storefront-page flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="storefront-hero-mesh w-full max-w-md rounded-3xl border border-[#075E54]/10 bg-white p-8 text-center shadow-wazo-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#075E54]/10 text-[#075E54]">
          <Store className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Boutique introuvable</h1>
        <p className="mt-2 text-sm text-[#1A1A1A]/65">
          Ce lien n&apos;existe pas ou la boutique n&apos;est plus publique.
        </p>
        <a
          href={landingUrl}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#FF6F00] px-6 py-3 text-sm font-bold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à Wazo Digital
        </a>
        <p className="mt-4 text-xs text-[#1A1A1A]/50">
          Vous avez une boutique ?{" "}
          <Link href={`${landingUrl}/register`} className="font-semibold text-[#075E54] underline">
            Créer la vôtre
          </Link>
        </p>
      </div>
    </div>
  );
}

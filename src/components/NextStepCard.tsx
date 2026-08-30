"use client";

import Link from "next/link";
import { ArrowRight, Crown, Package, Share2, ShoppingBag, Sparkles, Users } from "lucide-react";
import { isDay0ShareDone } from "@/lib/day0-mission";
import { isSafeStoreSlug } from "@/lib/utils";

type NextStep =
  | { id: "product"; title: string; hint: string; href: string; cta: string; Icon: typeof Package }
  | { id: "share"; title: string; hint: string; href: string; cta: string; Icon: typeof Share2 }
  | { id: "sale"; title: string; hint: string; href: string; cta: string; Icon: typeof ShoppingBag }
  | { id: "clients"; title: string; hint: string; href: string; cta: string; Icon: typeof Users }
  | { id: "pro"; title: string; hint: string; href: string; cta: string; Icon: typeof Crown }
  | { id: "grow"; title: string; hint: string; href: string; cta: string; Icon: typeof Sparkles };

function resolveNextStep(
  productsCount: number,
  salesCount: number,
  storeSlug?: string,
  proUpsellHref?: string | null
): NextStep {
  if (productsCount < 1) {
    return {
      id: "product",
      title: "Étape 1 — Ajoutez votre 1er produit",
      hint: "Nom, prix, stock. 2 minutes. La photo est optionnelle.",
      href: "/products/add",
      cta: "Ajouter un produit",
      Icon: Package,
    };
  }
  if (!isDay0ShareDone() && salesCount < 1) {
    return {
      id: "share",
      title: "Étape 2 — Partagez sur WhatsApp",
      hint: "Envoyez votre catalogue ou publiez en Status.",
      href: "/products?share=1&success=1",
      cta: "Partager",
      Icon: Share2,
    };
  }
  if (salesCount < 1) {
    return {
      id: "sale",
      title: "Étape 3 — Enregistrez une vente",
      hint: "Cash si moins de 200 FCFA, sinon MoMo. Puis partagez le reçu.",
      href: "/sales",
      cta: "Ouvrir la caisse",
      Icon: ShoppingBag,
    };
  }
  if (salesCount < 3) {
    return {
      id: "clients",
      title: "Étape 4 — Amenez vos clients",
      hint: "L'app ne vend pas toute seule. Status WhatsApp, 10 contacts, QR au comptoir — 3 vrais clients.",
      href: "/clients/bring",
      cta: "Amener des clients",
      Icon: Users,
    };
  }
  if (proUpsellHref) {
    return {
      id: "pro",
      title: "Étape 4 — Passez à Wazo PRO",
      hint: "Produits illimités, analytics et 3 boutiques. 9,99 €/mois via MoMo (~6 550 FCFA).",
      href: proUpsellHref,
      cta: "Activer PRO — MoMo",
      Icon: Crown,
    };
  }
  const boutique = isSafeStoreSlug(storeSlug) ? `/boutique/${storeSlug}` : "/products?share=1";
  return {
    id: "grow",
    title: "Parcours activé — continuez",
    hint: "Ajoutez des produits, vendez, et partagez votre boutique.",
    href: boutique,
    cta: isSafeStoreSlug(storeSlug) ? "Voir ma boutique" : "Partager",
    Icon: Sparkles,
  };
}

interface NextStepCardProps {
  productsCount: number;
  salesCount: number;
  storeSlug?: string;
  proUpsellHref?: string | null;
  className?: string;
}

export function NextStepCard({
  productsCount,
  salesCount,
  storeSlug,
  proUpsellHref = null,
  className = "",
}: NextStepCardProps) {
  const step = resolveNextStep(productsCount, salesCount, storeSlug, proUpsellHref);
  const Icon = step.Icon;
  const activated = step.id === "grow" || step.id === "pro" || step.id === "clients";
  const progress = Math.min(3, (productsCount >= 1 ? 1 : 0) + (isDay0ShareDone() || salesCount >= 1 ? 1 : 0) + (salesCount >= 1 ? 1 : 0));

  return (
    <section
      className={`rounded-3xl border p-5 shadow-sm ${
        activated
          ? "border-wazo-green/20 bg-white"
          : "border-[#FF6F00]/25 bg-gradient-to-br from-white to-[#FFF5EB]"
      } ${className}`}
    >
      {!activated ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#FF6F00]">
            Prochaine action
          </p>
          <p className="text-[11px] font-semibold text-gray-500">{progress}/3</p>
        </div>
      ) : (
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-wazo-green">
          {step.id === "pro" ? "Monétisation" : step.id === "clients" ? "Clients" : "Aujourd'hui"}
        </p>
      )}

      {!activated ? (
        <div className="mb-4 flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full ${
                n <= progress ? "bg-[#FF6F00]" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            activated ? "bg-wazo-green/10 text-wazo-green" : "bg-[#FF6F00]/15 text-[#FF6F00]"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold leading-snug text-gray-900">{step.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{step.hint}</p>
          <Link
            href={step.href}
            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.98] ${
              step.id === "pro"
                ? "bg-[#075E54] hover:brightness-105"
                : activated
                  ? "bg-wazo-green hover:brightness-105"
                  : "bg-[#FF6F00] hover:brightness-105"
            }`}
          >
            {step.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

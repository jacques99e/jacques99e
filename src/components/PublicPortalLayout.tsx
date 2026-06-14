"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, type LucideIcon } from "lucide-react";
import { getLandingLoginUrl, resolveLandingUrl } from "@/lib/public-urls";

type PortalAccent = "green" | "orange" | "teal";

const ACCENT_STYLES: Record<
  PortalAccent,
  { hero: string; iconBg: string; iconText: string; button: string }
> = {
  green: {
    hero: "bg-gradient-to-br from-[#075E54] via-[#075E54] to-[#128C7E]",
    iconBg: "bg-[#075E54]/10",
    iconText: "text-[#075E54]",
    button: "bg-[#075E54] hover:brightness-110",
  },
  orange: {
    hero: "bg-gradient-to-br from-[#FF6F00] via-[#FF6F00] to-[#FF8F33]",
    iconBg: "bg-[#FF6F00]/10",
    iconText: "text-[#FF6F00]",
    button: "bg-[#FF6F00] hover:brightness-110",
  },
  teal: {
    hero: "bg-gradient-to-br from-[#075E54] via-[#0a7a6e] to-[#128C7E]",
    iconBg: "bg-[#075E54]/10",
    iconText: "text-[#075E54]",
    button: "bg-[#075E54] hover:brightness-110",
  },
};

interface PublicPortalLayoutProps {
  icon: LucideIcon;
  badge: string;
  title: string;
  subtitle: string;
  accent?: PortalAccent;
  children: React.ReactNode;
  proHint?: string;
  proLinkLabel?: string;
}

export function PublicPortalLayout({
  icon: Icon,
  badge,
  title,
  subtitle,
  accent = "green",
  children,
  proHint = "Professionnel ?",
  proLinkLabel = "Connexion à l'app",
}: PublicPortalLayoutProps) {
  const landingUrl = resolveLandingUrl();
  const loginUrl = getLandingLoginUrl();
  const styles = ACCENT_STYLES[accent];

  return (
    <div className="storefront-page min-h-screen">
      <div className="border-b border-[#075E54]/10 bg-gradient-to-r from-[#075E54] to-[#0a7a6e] px-4 py-2 text-center text-xs font-medium text-white">
        Propulsé par{" "}
        <a href={landingUrl} className="font-bold underline underline-offset-2 hover:text-[#FF6F00]">
          Wazo Digital
        </a>
      </div>

      <header className={`relative overflow-hidden ${styles.hero} px-4 py-12 text-center text-white md:py-16`}>
        <div className="storefront-hero-mesh absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-white/10" />

        <div className="relative mx-auto max-w-lg">
          <div className="storefront-float mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/25 bg-white/15 backdrop-blur-sm">
            <Icon className="h-8 w-8" />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-[#FF6F00]" />
            {badge}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/85">{subtitle}</p>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-3xl border border-[#075E54]/10 bg-white p-6 shadow-wazo-lg md:p-8">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-[#1A1A1A]/55">
          {proHint}{" "}
          <a href={loginUrl} className="font-semibold text-[#075E54] underline">
            {proLinkLabel}
          </a>
        </p>
      </main>

      <footer className="border-t border-[#075E54]/10 bg-white px-4 py-8">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <a
            href={`${landingUrl}/register?plan=pro`}
            className="inline-flex items-center gap-2 rounded-full border border-[#075E54]/20 px-5 py-2.5 text-sm font-semibold text-[#075E54] transition hover:bg-[#075E54]/5"
          >
            Créer mon espace Wazo
            <ArrowRight className="h-4 w-4" />
          </a>
          <Link href={landingUrl} className="text-xs text-[#1A1A1A]/45 hover:text-[#075E54]">
            wazo-digital.com
          </Link>
        </div>
      </footer>
    </div>
  );
}

export function portalSubmitButtonClass(accent: PortalAccent = "green"): string {
  return `inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg transition ${ACCENT_STYLES[accent].button}`;
}

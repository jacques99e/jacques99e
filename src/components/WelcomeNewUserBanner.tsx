"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, PartyPopper, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveLandingUrl } from "@/lib/public-urls";
import {
  dismissWelcomeBanner,
  recordFirstDashboardVisit,
  shouldShowWelcomeBanner,
  WELCOME_STEPS,
} from "@/lib/welcome-new-user";

interface WelcomeNewUserBannerProps {
  storeName?: string;
  salesCount: number;
}

export function WelcomeNewUserBanner({ storeName, salesCount }: WelcomeNewUserBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    recordFirstDashboardVisit();
    setVisible(shouldShowWelcomeBanner(salesCount));
  }, [salesCount]);

  if (!visible) return null;

  const guideUrl = `${resolveLandingUrl()}/guide-pilote`;

  const close = () => {
    dismissWelcomeBanner();
    setVisible(false);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#075E54]/20 bg-gradient-to-br from-[#075E54]/5 to-[#FF6F00]/5 p-4 shadow-sm">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-white/80"
        onClick={close}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 text-[#075E54]">
        <PartyPopper className="h-5 w-5" />
        <h2 className="text-sm font-bold">
          Bienvenue{storeName ? `, ${storeName}` : ""} — votre boutique est prête
        </h2>
      </div>
      <p className="mt-2 text-xs text-gray-600">
        Trois étapes pour votre première journée sur Wazo Digital. Le guide pilote complet est
        aussi disponible si vous accompagnez une équipe.
      </p>

      <ol className="mt-4 space-y-2">
        {WELCOME_STEPS.map((step, i) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className="flex items-start gap-3 rounded-xl bg-white/80 p-3 text-left transition hover:bg-white"
            >
              <span className="text-lg">{step.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900">
                  {i + 1}. {step.title}
                </p>
                <p className="text-[11px] text-gray-500">{step.description}</p>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#075E54]" />
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="text-xs">
          <a href={guideUrl} target="_blank" rel="noreferrer">
            Guide pilote PDF
          </a>
        </Button>
        <Button size="sm" variant="ghost" className="text-xs text-gray-500" onClick={close}>
          J&apos;ai compris
        </Button>
      </div>
    </section>
  );
}

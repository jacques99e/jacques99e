"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DAY0_STEPS,
  getDay0Progress,
  isDay0MissionComplete,
  markDay0Complete,
} from "@/lib/day0-mission";
import { localStore } from "@/lib/db";
import { readLocalSales } from "@/lib/local-sales";
import { getProducts } from "@/lib/products";
import { resolveLandingUrl } from "@/lib/public-urls";
import {
  dismissWelcomeBanner,
  recordFirstDashboardVisit,
  shouldShowWelcomeBanner,
} from "@/lib/welcome-new-user";

interface WelcomeNewUserBannerProps {
  storeName?: string;
  salesCount: number;
}

export function WelcomeNewUserBanner({ storeName, salesCount }: WelcomeNewUserBannerProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState({
    productDone: false,
    saleDone: false,
    shareDone: false,
    done: 0,
    current: null as ReturnType<typeof getDay0Progress>["current"],
  });

  useEffect(() => {
    recordFirstDashboardVisit();
    const storeId = localStore.get()?.id;
    if (!storeId) {
      setVisible(shouldShowWelcomeBanner(salesCount));
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const products = await getProducts(storeId);
        const sales = readLocalSales(storeId);
        if (cancelled) return;
        const p = getDay0Progress(products.length, sales.length);
        setProgress({
          productDone: p.productDone,
          saleDone: p.saleDone,
          shareDone: p.shareDone,
          done: p.done,
          current: p.current,
        });
        if (isDay0MissionComplete(products.length, sales.length)) {
          markDay0Complete();
          dismissWelcomeBanner();
          setVisible(false);
          return;
        }
        setVisible(shouldShowWelcomeBanner(salesCount) || p.done < 3);
      } catch {
        if (!cancelled) setVisible(shouldShowWelcomeBanner(salesCount));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [salesCount]);

  if (!visible) return null;

  const guideUrl = `${resolveLandingUrl()}/guide-pilote`;
  const currentHref =
    DAY0_STEPS.find((s) => s.id === progress.current)?.href ?? "/products/add";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#075E54]/20 bg-gradient-to-br from-[#075E54]/5 to-[#FF6F00]/5 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[#075E54]">
        <PartyPopper className="h-5 w-5" />
        <h2 className="text-sm font-bold">
          Bienvenue{storeName ? `, ${storeName}` : ""} — mission du jour ({progress.done}/3)
        </h2>
      </div>
      <p className="mt-2 text-xs text-gray-600">
        Trois étapes pour activer votre boutique. Terminez-les pour vendre vraiment.
      </p>

      <ol className="mt-4 space-y-2">
        {DAY0_STEPS.map((step, i) => {
          const done =
            (step.id === "product" && progress.productDone) ||
            (step.id === "sale" && progress.saleDone) ||
            (step.id === "share" && progress.shareDone);
          return (
            <li key={step.href}>
              <Link
                href={step.href}
                className="flex items-start gap-3 rounded-xl bg-white/80 p-3 text-left transition hover:bg-white"
              >
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#075E54]" />
                ) : (
                  <span className="text-lg">{["📦", "📱", "💰"][i]}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-900">
                    {i + 1}. {step.title}
                  </p>
                  <p className="text-[11px] text-gray-500">{step.description}</p>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#075E54]" />
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" className="bg-[#075E54] text-xs hover:bg-[#064e47]">
          <Link href={currentHref}>Continuer</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="text-xs">
          <a href={guideUrl} target="_blank" rel="noreferrer">
            Guide pilote
          </a>
        </Button>
      </div>
    </section>
  );
}

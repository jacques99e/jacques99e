"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModule } from "@/hooks/useModule";
import { localStore } from "@/lib/db";
import {
  getGuidedStepsForModules,
  isGuidedOnboardingDone,
  markGuidedOnboardingDone,
} from "@/lib/guided-onboarding";
import { MODULE_LABELS } from "@/lib/modules/config";

export function GuidedOnboarding() {
  const storeId = localStore.get()?.id;
  const { modules, loading } = useModule(storeId);
  const steps = getGuidedStepsForModules(modules);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (loading || !storeId) return;
    if (!isGuidedOnboardingDone() && steps.length > 0) {
      setOpen(true);
      setIndex(0);
    }
  }, [loading, storeId, steps.length]);

  if (!open || steps.length === 0) return null;

  const step = steps[index];
  const isLast = index >= steps.length - 1;
  const moduleLabel = MODULE_LABELS[step.moduleId];

  const finish = () => {
    markGuidedOnboardingDone();
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="guided-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[#075E54]">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Première connexion · {index + 1}/{steps.length}
            </span>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            className="rounded p-1 text-gray-400 hover:bg-gray-100"
            onClick={finish}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {moduleLabel ? (
          <p className="mb-1 text-xs font-medium text-[#FF6F00]">{moduleLabel}</p>
        ) : null}
        <h2 id="guided-title" className="text-lg font-bold">
          {step.title}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{step.description}</p>

        <div className="mt-5 flex flex-col gap-2">
          <Button asChild className="w-full bg-[#075E54]">
            <Link href={step.href} onClick={isLast ? finish : undefined}>
              {step.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          {!isLast ? (
            <Button variant="outline" className="w-full" onClick={() => setIndex((i) => i + 1)}>
              Étape suivante
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={finish}>
              Terminer la visite guidée
            </Button>
          )}
          <button
            type="button"
            className="text-center text-xs text-gray-500 hover:underline"
            onClick={finish}
          >
            Passer pour l&apos;instant
          </button>
        </div>
      </div>
    </div>
  );
}

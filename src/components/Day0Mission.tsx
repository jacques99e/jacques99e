"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModule } from "@/hooks/useModule";
import { buildWhatsAppCatalog } from "@/lib/commerce-catalog";
import {
  DAY0_STEPS,
  getDay0Progress,
  isDay0MarkedDone,
  markDay0Complete,
  markDay0ShareDone,
  type Day0StepId,
} from "@/lib/day0-mission";
import { localStore } from "@/lib/db";
import { readLocalSales } from "@/lib/local-sales";
import { getProducts } from "@/lib/products";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";
import type { Product } from "@/types";

function pathMatchesStep(pathname: string, stepId: Day0StepId): boolean {
  if (stepId === "product") return pathname.startsWith("/products/add");
  if (stepId === "sale") return pathname.startsWith("/sales");
  if (stepId === "share") return pathname === "/products" || pathname.startsWith("/products?");
  return false;
}

export function Day0Mission() {
  const pathname = usePathname() || "";
  const storeId = localStore.get()?.id;
  const { modules, loading: modulesLoading } = useModule(storeId);
  const hasCommerce = modules.includes("commerce") || modules.length === 0;
  const [open, setOpen] = useState(false);
  const [stepId, setStepId] = useState<Day0StepId | null>(null);
  const [flags, setFlags] = useState({ productDone: false, saleDone: false, shareDone: false });
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (modulesLoading || !storeId || !hasCommerce) return;
    if (isDay0MarkedDone()) {
      setOpen(false);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const [rows, sales] = await Promise.all([
          getProducts(storeId),
          Promise.resolve(readLocalSales(storeId)),
        ]);
        if (cancelled) return;
        setProducts(rows);
        const progress = getDay0Progress(rows.length, sales.length);
        setFlags({
          productDone: progress.productDone,
          saleDone: progress.saleDone,
          shareDone: progress.shareDone,
        });
        if (progress.current) {
          setStepId(progress.current);
          setOpen(true);
          return;
        }
        markDay0Complete();
        setStepId(null);
        setOpen(false);
      } catch {
        if (!cancelled) setOpen(false);
      }
    };

    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void refresh(), 8000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [modulesLoading, storeId, hasCommerce, pathname]);

  if (!open || !stepId) return null;

  const step = DAY0_STEPS.find((s) => s.id === stepId) ?? DAY0_STEPS[0];
  const stepIndex = DAY0_STEPS.findIndex((s) => s.id === stepId) + 1;
  const onTargetPage = pathMatchesStep(pathname, stepId);

  const shareWhatsApp = () => {
    const store = localStore.get();
    const boutiqueUrl =
      store?.slug && typeof window !== "undefined"
        ? `${window.location.origin}/boutique/${store.slug}`
        : undefined;
    const text = buildWhatsAppCatalog({
      storeName: store?.name || "Ma boutique",
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock_quantity ?? 0,
        stock_quantity: p.stock_quantity ?? 0,
        category: "Autre",
        createdAt: p.created_at,
      })),
      boutiqueUrl,
    });
    markDay0ShareDone();
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
    // Si produit + vente déjà faits, la mission se clôt au prochain refresh.
    const sales = storeId ? readLocalSales(storeId) : [];
    if (products.length >= 1 && sales.length >= 1) {
      markDay0Complete();
      setOpen(false);
    } else {
      setFlags((f) => ({ ...f, shareDone: true }));
      setStepId(sales.length < 1 ? "sale" : null);
      if (sales.length >= 1) setOpen(false);
    }
  };

  // Sur /products avec sheet partage : ne pas recouvrir l'action.
  if (onTargetPage && stepId === "share") {
    return (
      <div className="fixed inset-x-0 bottom-16 z-[90] px-3 pb-2 sm:bottom-4">
        <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-[#25D366]/40 bg-white px-3 py-2.5 shadow-lg">
          <Rocket className="h-4 w-4 shrink-0 text-[#128C7E]" />
          <p className="min-w-0 flex-1 text-xs font-medium text-gray-800">
            Mission {stepIndex}/3 — cliquez « Partager le catalogue WhatsApp »
          </p>
        </div>
      </div>
    );
  }

  // Sur la page cible : barre compacte pour ne pas bloquer l'action.
  if (onTargetPage) {
    return (
      <div className="fixed inset-x-0 bottom-16 z-[90] px-3 pb-2 sm:bottom-4">
        <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-[#075E54]/25 bg-white px-3 py-2.5 shadow-lg">
          <Rocket className="h-4 w-4 shrink-0 text-[#075E54]" />
          <p className="min-w-0 flex-1 text-xs font-medium text-gray-800">
            Mission {stepIndex}/3 — {step.title}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="day0-title"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"
      >
        <div className="mb-3 flex items-center gap-2 text-[#075E54]">
          <Rocket className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Mission du jour · {stepIndex}/3
          </span>
        </div>

        <div className="mb-4 flex gap-1.5">
          {DAY0_STEPS.map((s) => {
            const done =
              (s.id === "product" && flags.productDone) ||
              (s.id === "sale" && flags.saleDone) ||
              (s.id === "share" && flags.shareDone);
            const current = s.id === stepId;
            return (
              <div
                key={s.id}
                className={`h-1.5 flex-1 rounded-full ${
                  done || current ? "bg-[#075E54]" : "bg-gray-200"
                }`}
              />
            );
          })}
        </div>

        <h2 id="day0-title" className="text-lg font-bold text-gray-900">
          {step.title}
        </h2>
        <p className="mt-2 text-sm text-gray-600">{step.description}</p>

        <ul className="mt-4 space-y-2 text-xs text-gray-600">
          {DAY0_STEPS.map((s, i) => {
            const complete =
              (s.id === "product" && flags.productDone) ||
              (s.id === "sale" && flags.saleDone) ||
              (s.id === "share" && flags.shareDone);
            const current = s.id === stepId;
            return (
              <li
                key={s.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                  current ? "bg-[#075E54]/10 font-medium text-[#075E54]" : ""
                }`}
              >
                {complete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#075E54]" />
                ) : (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[10px]">
                    {i + 1}
                  </span>
                )}
                {s.title}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 space-y-2">
          {stepId === "share" ? (
            <>
              <Button
                type="button"
                className="w-full bg-[#25D366] text-white hover:bg-[#1da851]"
                onClick={shareWhatsApp}
                disabled={products.length === 0}
              >
                Partager le catalogue WhatsApp
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/products?share=1">Voir mes produits</Link>
              </Button>
            </>
          ) : (
            <Button asChild className="w-full bg-[#075E54] hover:bg-[#064e47]">
              <Link href={step.href}>
                {step.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          <p className="text-center text-[11px] text-gray-500">
            Terminez ces 3 étapes pour démarrer vraiment — ~5 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}

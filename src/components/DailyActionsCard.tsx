"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Lightbulb, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import {
  buildCodOrdersAction,
  buildDailyActionWhatsAppMessage,
  computeDailyActions,
  dismissDailyAction,
  mapActionTypeToDraftType,
  runDailyActionWhatsApp,
  type DailyAction,
} from "@/lib/daily-actions";
import { localStore } from "@/lib/db";
import { sendWhatsAppAuto } from "@/lib/whatsapp-send-client";

interface DailyActionsCardProps {
  storeName?: string;
  limit?: number;
  /** Compact = dashboard ; full = insights */
  variant?: "compact" | "full";
  className?: string;
}

async function fetchAiDraft(action: DailyAction, storeName: string): Promise<string | null> {
  if (!action.whatsapp) return null;
  // Catalogue déjà prérempli localement : pas besoin d'IA
  if (action.type === "share_catalog" && action.whatsapp.prefilledMessage) {
    return action.whatsapp.prefilledMessage;
  }

  try {
    const store = localStore.get();
    const boutiqueUrl = store?.slug
      ? `https://app.wazo-digital.com/boutique/${store.slug}`
      : undefined;
    const res = await apiFetch("/api/assistant/draft-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: mapActionTypeToDraftType(action.type),
        storeName,
        clientName: action.entity?.kind === "client" ? action.entity.name : undefined,
        productName: action.entity?.kind === "product" ? action.entity.name : undefined,
        context: action.whatsapp.draftHint || action.reason,
        boutiqueUrl,
      }),
    });
    const data = (await res.json()) as {
      success?: boolean;
      message?: string;
    };
    if (res.ok && data.success && data.message?.trim()) {
      return data.message.trim();
    }
  } catch {
    /* fallback local */
  }
  return null;
}

export function DailyActionsCard({
  storeName,
  limit = 3,
  variant = "compact",
  className = "",
}: DailyActionsCardProps) {
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [waError, setWaError] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const resolvedName =
    storeName || localStore.get()?.name || "Wazo Digital";

  const refresh = useCallback(() => {
    const base = computeDailyActions({ storeName: resolvedName, limit });
    setActions(base);

    const storeId = localStore.get()?.id;
    if (!storeId || !navigator.onLine) return;

    void apiFetch(`/api/boutique/orders?storeId=${encodeURIComponent(storeId)}&status=pending`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          success?: boolean;
          orders?: unknown[];
        };
        if (!res.ok || !data.success) return;
        const cod = buildCodOrdersAction(data.orders?.length || 0);
        if (!cod) return;
        setActions((prev) => {
          const without = prev.filter((a) => a.id !== cod.id);
          return [cod, ...without].slice(0, limit);
        });
      })
      .catch(() => undefined);
  }, [resolvedName, limit]);

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (
        !e.key ||
        e.key.startsWith("wazo_sales") ||
        e.key.startsWith("wazo_products") ||
        e.key.startsWith("wazo_clients") ||
        e.key === "wazo_business_settings" ||
        e.key === "wazo_daily_actions_dismissed"
      ) {
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("wazo-business-settings-changed", refresh);
    window.addEventListener("wazo-alerts-refresh", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wazo-business-settings-changed", refresh);
      window.removeEventListener("wazo-alerts-refresh", refresh);
    };
  }, [refresh]);

  const onDismiss = (id: string) => {
    dismissDailyAction(id);
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const onWhatsApp = async (action: DailyAction) => {
    setWaError("");
    setLoadingId(action.id);
    try {
      const drafted = await fetchAiDraft(action, resolvedName);
      const message =
        drafted?.trim() ||
        buildDailyActionWhatsAppMessage(action, resolvedName) ||
        "";
      const phone = action.whatsapp?.phone?.trim();

      if (phone && message) {
        const result = await sendWhatsAppAuto({ phone, message });
        if (!result.ok) {
          setWaError(
            result.error ||
              "Impossible d’envoyer WhatsApp. Vérifiez le numéro du client."
          );
          return;
        }
      } else {
        const ok = runDailyActionWhatsApp(
          action,
          resolvedName,
          drafted || undefined
        );
        if (!ok) {
          setWaError(
            "Impossible d’ouvrir WhatsApp. Vérifiez le numéro du client."
          );
          return;
        }
      }
      dismissDailyAction(action.id);
      setActions((prev) => prev.filter((a) => a.id !== action.id));
    } finally {
      setLoadingId(null);
    }
  };

  if (!actions.length) return null;

  return (
    <section
      className={`rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm ${className}`}
    >
      <div className="mb-3 flex items-center gap-2 text-amber-950">
        <Lightbulb className="h-4 w-4 shrink-0 text-[#FF6F00]" />
        <h2 className="text-sm font-semibold">Que faire aujourd’hui ?</h2>
      </div>

      <ul className="space-y-3">
        {actions.map((action, index) => (
          <li
            key={action.id}
            className="rounded-xl border border-amber-100/80 bg-white/80 p-3"
          >
            <div className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF6F00] text-[10px] font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {action.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-600">{action.reason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {action.whatsapp ? (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#075E54] hover:bg-[#064e47]"
                      disabled={loadingId === action.id}
                      onClick={() => void onWhatsApp(action)}
                    >
                      {loadingId === action.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5" />
                      )}
                      {loadingId === action.id ? "Envoi…" : action.ctaLabel}
                    </Button>
                  ) : action.href ? (
                    <Button asChild size="sm" variant="orange">
                      <Link href={action.href}>{action.ctaLabel}</Link>
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onDismiss(action.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title="Marquer comme fait"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Fait
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {waError ? (
        <p className="mt-2 text-xs text-red-600">{waError}</p>
      ) : null}

      {variant === "full" ? (
        <p className="mt-3 text-[11px] text-amber-800/80">
          Actions basées sur votre stock, ventes et clients. Si WhatsApp Business
          API est configurée, l’envoi est automatique ; sinon ouverture de wa.me.
        </p>
      ) : (
        <Link
          href="/insights"
          className="mt-3 inline-block text-xs font-medium text-[#FF6F00] hover:underline"
        >
          Voir Insights Pro →
        </Link>
      )}
    </section>
  );
}

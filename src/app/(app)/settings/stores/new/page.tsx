"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanUpgradeGate } from "@/components/PlanUpgradeGate";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api-client";
import { setActiveStore } from "@/lib/stores-multi";
import { mapErrorToUserMessage } from "@/lib/user-messages";
import { slugify } from "@/lib/utils";
import type { BillingPlanId } from "@/lib/billing";
import type { Store } from "@/types";

interface StoreAccessResponse {
  success: boolean;
  ownedCount?: number;
  effectivePlan?: BillingPlanId;
  limits?: { maxStores: number };
  canCreateStore?: boolean;
  error?: string;
}

export default function NewStorePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [ownedCount, setOwnedCount] = useState(0);
  const [maxStores, setMaxStores] = useState(1);
  const [effectivePlan, setEffectivePlan] = useState<BillingPlanId>("starter");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch("/api/stores", { cache: "no-store" });
        const data = (await res.json()) as StoreAccessResponse;
        if (res.ok && data.success) {
          setCanCreate(Boolean(data.canCreateStore));
          setOwnedCount(data.ownedCount ?? 0);
          setMaxStores(data.limits?.maxStores ?? 1);
          setEffectivePlan(data.effectivePlan ?? "starter");
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || slugify(name),
          phone: user.phone,
        }),
      });
      const data = (await res.json()) as {
        success: boolean;
        store?: Store;
        error?: string;
      };
      if (!res.ok || !data.success || !data.store) {
        setError(data.error || "Impossible de créer la boutique.");
        return;
      }
      setActiveStore(data.store);
      router.push("/dashboard");
    } catch (err) {
      setError(mapErrorToUserMessage(err, "Impossible de créer la boutique."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wazo-green border-t-transparent" />
      </div>
    );
  }

  if (!canCreate) {
    const requiredPlan: BillingPlanId = effectivePlan === "starter" ? "pro" : "business";
    return (
      <PlanUpgradeGate
        title="Nouvelle boutique"
        message={`Vous avez ${ownedCount}/${maxStores} boutique(s) sur le plan ${effectivePlan.toUpperCase()}. Passez au plan supérieur pour en ajouter.`}
        requiredPlan={requiredPlan}
      />
    );
  }

  return (
    <>
      <AppHeader title="Nouvelle boutique" subtitle={`${ownedCount}/${maxStores} utilisée(s)`} />
      <main className="app-page mx-auto max-w-md space-y-4 pb-6">
        <form onSubmit={handleSubmit} className="app-card space-y-4 p-4">
          <div>
            <Label>Nom de la boutique</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(slugify(e.target.value));
              }}
              required
              placeholder="Ex: Boutique Awa 2"
              className="mt-2"
            />
          </div>
          <div>
            <Label>URL publique</Label>
            <p className="mb-1 text-xs text-gray-500">wazo.digital/boutique/{slug || "..."}</p>
            <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Création..." : "Créer la boutique"}
          </Button>
        </form>
        <Link href="/settings" className="block text-center text-xs text-gray-500">
          ← Paramètres
        </Link>
      </main>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { ModuleCard } from "@/components/ModuleCard";
import { localModules, localStore } from "@/lib/db";
import { ALL_MODULE_IDS, normalizeModuleIds } from "@/lib/modules/config";
import {
  applyPendingModule,
  billingCheckoutPath,
  isPaidVitrinePlan,
  readPendingPlan,
  readPendingPlanPay,
} from "@/lib/modules/preference";
import { setBusinessVertical } from "@/lib/onboarding";
import { apiFetch } from "@/lib/api-client";
import { ensureUserProfile } from "@/lib/ensure-profile";
import { mapErrorToUserMessage } from "@/lib/user-messages";
import { getLandingLoginUrl } from "@/lib/public-urls";
import { slugify } from "@/lib/utils";
import {
  isValidWhatsAppPhone,
  normalizeWhatsAppPhone,
  whatsappFromUser,
} from "@/lib/whatsapp-phone";
import type { ModuleId, Store } from "@/types";

export default function SetupPage() {
  const { t } = useI18n();
  const { user, supabase, loading: authLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [offlineInfo, setOfflineInfo] = useState("");
  const [selectedModules, setSelectedModules] = useState<ModuleId[]>(() => localModules.get());

  useEffect(() => {
    const pending = applyPendingModule();
    if (pending) setSelectedModules(normalizeModuleIds([pending]));
  }, []);

  const toggleModule = (id: ModuleId) => {
    setSelectedModules((prev) => {
      const next = prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
      return next.length ? next : ["commerce"];
    });
  };

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(slugify(v));
  };

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user) {
        window.location.href = getLandingLoginUrl();
        return;
      }

      if (!user) {
        setLoading(false);
        return;
      }

      const existingWa = whatsappFromUser(user);
      if (existingWa) setWhatsapp(existingWa);

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("active_modules, full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (!cancelled && profile?.active_modules) {
          const mods = normalizeModuleIds(profile.active_modules as string[]);
          localModules.save(mods);
          setSelectedModules(mods);
          setBusinessVertical(mods[0]);
        }
        if (!cancelled && !name && profile?.full_name) {
          setName(profile.full_name);
          setSlug(slugify(profile.full_name));
        }

        const { data, error: fetchError } = await supabase
          .from("stores")
          .select("*")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();
        if (fetchError) throw fetchError;

        if (cancelled) return;
        if (data) {
          localStore.save(data as Store);
          localStorage.setItem("store_name", data.name || "");
          localStorage.setItem("store_slug", data.slug || "");
          localStorage.setItem("store_setup_complete", "true");
          router.replace("/dashboard");
          return;
        }
      } catch {
        if (cancelled) return;
        const localName = localStorage.getItem("store_name");
        const localSlug = localStorage.getItem("store_slug");
        if (localName && localSlug) {
          const wa = whatsappFromUser(user) || null;
          const fallbackStore: Store = {
            id: "local-store-fallback",
            owner_id: user.id,
            name: localName,
            slug: localSlug,
            description: null,
            phone: wa,
            whatsapp: wa,
            logo_url: null,
            is_public: true,
          };
          localStore.save(fallbackStore);
          setOfflineInfo("Mode hors ligne - données locales");
          router.replace("/dashboard");
          return;
        }
        setOfflineInfo("Mode hors ligne - données locales");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!isValidWhatsAppPhone(whatsapp)) {
      setError("Indiquez un numéro WhatsApp valide avec indicatif (ex: +228 90 00 00 00).");
      return;
    }
    const finalSlug = slug || slugify(name);
    const ownerId = user?.id || "test-user-123";
    const phone = normalizeWhatsAppPhone(whatsapp);
    const modules = normalizeModuleIds(selectedModules);
    setSubmitting(true);
    setError("");
    setOfflineInfo("");

    try {
      localModules.save(modules);
      setBusinessVertical(modules[0]);
      localStorage.setItem("store_name", name);
      localStorage.setItem("store_slug", finalSlug);
      localStorage.setItem("store_setup_complete", "true");

      const store: Store = {
        id: "local-store-test",
        owner_id: ownerId,
        name,
        slug: finalSlug,
        description: null,
        phone,
        whatsapp: phone,
        logo_url: null,
        is_public: true,
      };
      localStore.save(store);

      if (typeof window !== "undefined") {
        const { db } = await import("@/lib/db");
        if (db) await db.store.put(store);
      }

      if (user) {
        const profileResult = await ensureUserProfile(supabase, user.id, phone);
        if (!profileResult.ok) {
          setError(profileResult.error);
          setSubmitting(false);
          return;
        }

        await supabase
          .from("profiles")
          .update({ phone })
          .eq("id", user.id);
        await supabase.auth.updateUser({
          data: { whatsapp: phone, phone },
        });

        const accessRes = await apiFetch("/api/stores", { cache: "no-store" });
        const accessData = (await accessRes.json()) as {
          success?: boolean;
          canCreateStore?: boolean;
          limits?: { maxStores: number };
          error?: string;
        };
        if (!accessRes.ok || !accessData.canCreateStore) {
          setError(
            accessData.error ||
              `Limite de boutiques atteinte (${accessData.limits?.maxStores ?? 1}). Passez au plan PRO pour en créer davantage.`
          );
          setSubmitting(false);
          return;
        }

        // Création via API (service role) : persiste store_modules + stores.modules + profiles.
        const createRes = await apiFetch("/api/stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            slug: finalSlug,
            phone,
            modules,
          }),
        });
        const createData = (await createRes.json()) as {
          success?: boolean;
          store?: Store;
          modules?: string[];
          error?: string;
        };
        if (!createRes.ok || !createData.success || !createData.store) {
          setError(
            createData.error ||
              "Impossible d'enregistrer votre boutique pour le moment."
          );
          setSubmitting(false);
          return;
        }

        const savedStore = createData.store;
        localStore.save(savedStore);
        localStorage.setItem("store_slug", savedStore.slug);
        localModules.save(normalizeModuleIds(createData.modules || modules));

        await supabase
          .from("profiles")
          .upsert({ id: user.id, phone, active_modules: modules }, { onConflict: "id" });
        await supabase
          .from("stores")
          .update({ whatsapp: phone, phone })
          .eq("id", savedStore.id);
      }

      const pendingPlan = readPendingPlan();
      const wantsPay = readPendingPlanPay();
      if (wantsPay && pendingPlan && isPaidVitrinePlan(pendingPlan)) {
        router.push(billingCheckoutPath(pendingPlan));
      } else {
        router.push("/dashboard");
      }
    } catch (e) {
      const message = mapErrorToUserMessage(e, t("common.error"));
      setError(message);
      router.push("/dashboard");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wazo-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wazo-green border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="app-shell flex min-h-screen items-center px-4 py-8">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-wazo-green/10 text-2xl">
            🏪
          </div>
          <h1 className="text-2xl font-bold text-wazo-green">Configurez votre activité</h1>
          <p className="mt-1 text-sm text-gray-600">
            2 minutes — comme promis sur la vitrine. Caisse MoMo, modules et mode hors ligne inclus.
          </p>
        </div>
        {offlineInfo && (
          <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700">
            {offlineInfo}
          </p>
        )}
        <form onSubmit={handleSubmit} className="app-card space-y-4 p-6">
          <div>
            <Label className="text-base">Nom de la boutique</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              placeholder="Ex: Boutique Awa"
              className="mt-2 h-14 text-lg"
            />
          </div>
          <div>
            <Label className="text-base">WhatsApp (obligatoire)</Label>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              placeholder="+228 90 00 00 00"
              className="mt-2 h-14 text-lg"
            />
            <p className="mt-1 text-xs text-gray-500">
              Pour les commandes clients et notre accompagnement.
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("modules.title")}</Label>
            <p className="text-xs text-gray-500">
              Seules les fonctionnalités choisies apparaîtront sur votre tableau de bord.
            </p>
            {ALL_MODULE_IDS.map((id) => (
              <ModuleCard
                key={id}
                moduleId={id}
                enabled={selectedModules.includes(id)}
                onToggle={toggleModule}
              />
            ))}
          </div>
          <div>
            <Label>{t("setup.slug")}</Label>
            <p className="mb-1 text-xs text-gray-500">
              {t("setup.slugHint")}
              {slug}
            </p>
            <Input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              required
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="h-14 w-full text-lg font-bold" disabled={submitting}>
            {submitting ? t("common.loading") : "Commencer ✅"}
          </Button>
        </form>
      </div>
    </div>
  );
}

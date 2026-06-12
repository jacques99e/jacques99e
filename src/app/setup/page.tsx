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
import { applyPendingModule } from "@/lib/modules/preference";
import { setBusinessVertical } from "@/lib/onboarding";
import { mapErrorToUserMessage } from "@/lib/user-messages";
import { slugify } from "@/lib/utils";
import type { ModuleId, Store } from "@/types";

export default function SetupPage() {
  const { t } = useI18n();
  const { user, supabase, loading: authLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
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
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const init = async () => {
      try {
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
          const fallbackStore: Store = {
            id: "local-store-fallback",
            owner_id: user.id,
            name: localName,
            slug: localSlug,
            description: null,
            phone: user.phone || null,
            whatsapp: user.phone || null,
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
    const finalSlug = slug || slugify(name);
    const ownerId = user?.id || "test-user-123";
    const phone = user?.phone || "+221771234567";
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
        // La table stores possede une FK owner_id -> profiles.id. Si le profil
        // n'existe pas encore (trigger d'inscription absent en base), l'insertion
        // de la boutique echoue avec une violation de cle etrangere (23503).
        // On garantit donc la presence du profil avant de creer la boutique.
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({ id: user.id, phone: user.phone ?? null }, { onConflict: "id" });
        if (profileError) {
          setError(
            mapErrorToUserMessage(profileError, "Impossible de preparer votre profil pour le moment.")
          );
          setSubmitting(false);
          return;
        }

        let candidateSlug = finalSlug;
        let savedStore: Store | null = null;

        for (let attempt = 0; attempt < 6; attempt++) {
          const { data, error: insertError } = await supabase
            .from("stores")
            .insert({
              owner_id: user.id,
              name,
              slug: candidateSlug,
              phone: user.phone,
              whatsapp: user.phone,
              is_public: true,
            })
            .select()
            .single();

          if (!insertError) {
            savedStore = data as Store;
            break;
          }

          if (insertError.code === "23505") {
            const suffix = Math.random().toString(36).slice(2, 6);
            candidateSlug = `${finalSlug}-${suffix}`;
            continue;
          }

          setError(
            mapErrorToUserMessage(insertError, "Impossible d'enregistrer votre boutique pour le moment.")
          );
          setSubmitting(false);
          return;
        }

        if (!savedStore) {
          setError(
            "Impossible de generer une URL publique unique. Essaie un autre nom d'activite.",
          );
          setSubmitting(false);
          return;
        }

        localStore.save(savedStore);
        localStorage.setItem("store_slug", savedStore.slug);

        await supabase
          .from("profiles")
          .upsert({ id: user.id, phone: user.phone ?? null, active_modules: modules }, { onConflict: "id" });

        await supabase.from("store_modules").delete().eq("store_id", savedStore.id);
        if (modules.length) {
          await supabase.from("store_modules").insert(
            modules.map((module_id) => ({ store_id: savedStore.id, module_id, enabled: true }))
          );
        }
      }

      router.push("/dashboard");
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { slugify } from "@/lib/utils";
import type { Store } from "@/types";

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
    setSubmitting(true);
    setError("");
    setOfflineInfo("");

    try {
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
        try {
          const { data, error: insertError } = await supabase
            .from("stores")
            .insert({
              owner_id: user.id,
              name,
              slug: finalSlug,
              phone: user.phone,
              whatsapp: user.phone,
              is_public: true,
            })
            .select()
            .single();
          if (insertError) throw insertError;
          if (data) {
            localStore.save(data as Store);
          }
        } catch {
          setOfflineInfo("Mode hors ligne - données locales");
        }
      }

      router.push("/dashboard");
    } catch (e) {
      const message = e instanceof Error ? e.message : t("common.error");
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
    <div className="min-h-screen bg-wazo-cream px-4 py-8">
      <div className="mx-auto max-w-sm space-y-6">
        <h1 className="text-xl font-bold text-wazo-green">{t("setup.title")}</h1>
        {offlineInfo && (
          <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700">
            {offlineInfo}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow">
          <div>
            <Label>{t("auth.shopName")}</Label>
            <Input value={name} onChange={(e) => handleNameChange(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>{t("setup.slug")}</Label>
            <p className="text-xs text-gray-500 mb-1">{t("setup.slugHint")}{slug}</p>
            <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required className="mt-1" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t("common.loading") : t("setup.continue")}
          </Button>
        </form>
      </div>
    </div>
  );
}

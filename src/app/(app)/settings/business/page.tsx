"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getBusinessSettings,
  saveBusinessSettings,
  type BusinessSettings,
  type WhatsAppTemplate,
} from "@/lib/business-settings";
import { notifyAlertsChanged } from "@/lib/alerts";
import { localStore } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import type { Store } from "@/types";

export default function BusinessSettingsPage() {
  const { user, supabase } = useAuth();
  const { canManageSettings } = useRole(user?.id);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identityMessage, setIdentityMessage] = useState("");
  const [storeIdentity, setStoreIdentity] = useState<{
    id: string;
    name: string;
    description: string;
    phone: string;
    whatsapp: string;
    logo_url: string;
    cover_url: string;
  } | null>(null);

  useEffect(() => {
    setSettings(getBusinessSettings());
    const store = localStore.get();
    if (!store) return;
    setStoreIdentity({
      id: store.id,
      name: store.name || "",
      description: store.description || "",
      phone: store.phone || "",
      whatsapp: store.whatsapp || "",
      logo_url: store.logo_url || "",
      cover_url: store.cover_url || "",
    });
  }, []);

  if (!canManageSettings) {
    return (
      <>
        <AppHeader title="Paramètres métier" />
        <main className="mx-auto max-w-lg p-4">
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Réservé au propriétaire de la boutique.
          </p>
        </main>
      </>
    );
  }

  const persist = (next: BusinessSettings) => {
    setSettings(next);
    saveBusinessSettings(next);
    notifyAlertsChanged();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateTemplate = (id: string, patch: Partial<WhatsAppTemplate>) => {
    persist({
      ...settings,
      whatsappTemplates: settings.whatsappTemplates.map((t) =>
        t.id === id ? { ...t, ...patch } : t
      ),
    });
  };

  const addTemplate = () => {
    const id = `tpl-${uuidv4().slice(0, 8)}`;
    persist({
      ...settings,
      whatsappTemplates: [
        ...settings.whatsappTemplates,
        {
          id,
          name: "Nouveau modèle",
          body: "Bonjour {{clientName}},\n\nMessage de {{storeName}}.\n{{noteLine}}",
        },
      ],
    });
  };

  const removeTemplate = (id: string) => {
    if (settings.whatsappTemplates.length <= 1) return;
    const next = settings.whatsappTemplates.filter((t) => t.id !== id);
    persist({
      ...settings,
      whatsappTemplates: next,
      defaultWhatsAppTemplateId:
        settings.defaultWhatsAppTemplateId === id
          ? next[0].id
          : settings.defaultWhatsAppTemplateId,
    });
  };

  const resetDefaults = () => {
    if (!confirm("Réinitialiser tous les paramètres métier ?")) return;
    persist(DEFAULT_BUSINESS_SETTINGS);
  };

  const uploadStoreAsset = async (file: File, kind: "logo" | "cover"): Promise<string> => {
    if (!user?.id) throw new Error("Session introuvable.");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/stores/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const saveStoreIdentity = async () => {
    if (!storeIdentity?.id || !user?.id) return;
    setSavingIdentity(true);
    setIdentityMessage("");
    try {
      const payload = {
        name: storeIdentity.name.trim() || "Ma boutique",
        description: storeIdentity.description.trim() || null,
        phone: storeIdentity.phone.trim() || null,
        whatsapp: storeIdentity.whatsapp.trim() || null,
        logo_url: storeIdentity.logo_url.trim() || null,
        cover_url: storeIdentity.cover_url.trim() || null,
      };
      const { data, error } = await supabase
        .from("stores")
        .update(payload)
        .eq("id", storeIdentity.id)
        .eq("owner_id", user.id)
        .select("*")
        .single();

      if (error) throw error;
      if (data) localStore.save(data as Store);
      setIdentityMessage("Identité boutique enregistrée.");
    } catch {
      setIdentityMessage("Impossible d'enregistrer la boutique pour le moment.");
    } finally {
      setSavingIdentity(false);
    }
  };

  return (
    <>
      <AppHeader title="Paramètres métier" />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-xs text-gray-500">
          Seuils d&apos;alerte, objectifs et modèles WhatsApp personnalisables.
        </p>

        {storeIdentity ? (
          <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <h2 className="text-sm font-semibold">Identité boutique (logo & couverture)</h2>
            <label className="block text-xs text-gray-500">Nom boutique</label>
            <Input
              value={storeIdentity.name}
              onChange={(e) =>
                setStoreIdentity((prev) => (prev ? { ...prev, name: e.target.value } : prev))
              }
            />
            <label className="block text-xs text-gray-500">Description</label>
            <Input
              value={storeIdentity.description}
              onChange={(e) =>
                setStoreIdentity((prev) =>
                  prev ? { ...prev, description: e.target.value } : prev
                )
              }
              placeholder="Présentez votre boutique"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500">Téléphone</label>
                <Input
                  value={storeIdentity.phone}
                  onChange={(e) =>
                    setStoreIdentity((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">WhatsApp</label>
                <Input
                  value={storeIdentity.whatsapp}
                  onChange={(e) =>
                    setStoreIdentity((prev) =>
                      prev ? { ...prev, whatsapp: e.target.value } : prev
                    )
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-gray-500">Logo boutique</label>
              {storeIdentity.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storeIdentity.logo_url} alt="" className="h-20 w-20 rounded-xl object-cover" />
              ) : null}
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const url = await uploadStoreAsset(file, "logo");
                    setStoreIdentity((prev) => (prev ? { ...prev, logo_url: url } : prev));
                  } catch {
                    setIdentityMessage("Upload logo impossible.");
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-gray-500">Couverture boutique</label>
              {storeIdentity.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storeIdentity.cover_url} alt="" className="h-24 w-full rounded-xl object-cover" />
              ) : null}
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const url = await uploadStoreAsset(file, "cover");
                    setStoreIdentity((prev) => (prev ? { ...prev, cover_url: url } : prev));
                  } catch {
                    setIdentityMessage("Upload couverture impossible.");
                  }
                }}
              />
            </div>

            <Button className="w-full bg-[#075E54]" disabled={savingIdentity} onClick={saveStoreIdentity}>
              {savingIdentity ? "Enregistrement..." : "Enregistrer identité boutique"}
            </Button>
            {identityMessage ? <p className="text-xs text-gray-600">{identityMessage}</p> : null}
          </section>
        ) : null}

        <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Stock & objectifs</h2>
          <label className="block text-xs text-gray-500">
            Seuil stock faible (unités)
          </label>
          <Input
            type="number"
            min={1}
            max={500}
            value={settings.lowStockThreshold}
            onChange={(e) =>
              setSettings({
                ...settings,
                lowStockThreshold: Number(e.target.value) || 5,
              })
            }
          />
          <label className="block text-xs text-gray-500">
            Objectif CA mensuel (FCFA, optionnel)
          </label>
          <Input
            type="number"
            min={0}
            placeholder="Ex: 500000"
            value={settings.monthlyRevenueTarget ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                monthlyRevenueTarget: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
          <Button
            className="w-full bg-[#075E54]"
            onClick={() => persist(settings)}
          >
            Enregistrer stock & objectifs
          </Button>
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Modèles WhatsApp</h2>
            <Button type="button" size="sm" variant="outline" onClick={addTemplate}>
              + Modèle
            </Button>
          </div>
          <p className="text-[10px] text-gray-500">
            Variables: {"{{clientName}}"}, {"{{storeName}}"}, {"{{followUpLine}}"}, {"{{noteLine}}"}
          </p>
          <label className="block text-xs text-gray-500">Modèle par défaut</label>
          <select
            value={settings.defaultWhatsAppTemplateId}
            onChange={(e) =>
              persist({ ...settings, defaultWhatsAppTemplateId: e.target.value })
            }
            className="h-11 w-full rounded-lg border px-3 text-sm dark:bg-gray-900"
          >
            {settings.whatsappTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {settings.whatsappTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="space-y-2 rounded-lg border border-gray-100 p-3 dark:border-gray-700"
            >
              <Input
                value={tpl.name}
                onChange={(e) => updateTemplate(tpl.id, { name: e.target.value })}
                placeholder="Nom du modèle"
              />
              <textarea
                value={tpl.body}
                onChange={(e) => updateTemplate(tpl.id, { body: e.target.value })}
                rows={5}
                className="w-full rounded-lg border px-3 py-2 text-xs dark:bg-gray-900"
              />
              {settings.whatsappTemplates.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                  onClick={() => removeTemplate(tpl.id)}
                >
                  Supprimer
                </Button>
              ) : null}
            </div>
          ))}
        </section>

        {saved ? (
          <p className="text-center text-xs text-green-600">Paramètres enregistrés.</p>
        ) : null}

        <Button variant="outline" className="w-full" onClick={resetDefaults}>
          Réinitialiser par défaut
        </Button>
        <Link
          href="/insights"
          className="block text-center text-sm text-[#075E54] underline"
        >
          Voir Insights Pro →
        </Link>
        <Link href="/settings" className="block text-center text-xs text-gray-500">
          ← Retour paramètres techniques
        </Link>
      </main>
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Facebook, Instagram, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

type Status = {
  configured: boolean;
  connected: boolean;
  pageName: string | null;
  instagram: boolean;
  igUsername: string | null;
};

export function StoreSocialPanel({ storeId }: { storeId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/social/meta/status?storeId=${encodeURIComponent(storeId)}`);
      const data = (await res.json()) as Status & { success?: boolean; error?: string };
      if (!res.ok) {
        setMessage(data.error || "Impossible de charger le statut réseaux.");
        setStatus(null);
        return;
      }
      setStatus({
        configured: Boolean(data.configured),
        connected: Boolean(data.connected),
        pageName: data.pageName || null,
        instagram: Boolean(data.instagram),
        igUsername: data.igUsername || null,
      });
    } catch {
      setMessage("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const social = params.get("social");
    if (social === "ok") {
      setMessage(`Facebook connecté${params.get("page") ? ` : ${params.get("page")}` : ""}.`);
      void load();
      window.history.replaceState({}, "", "/settings/business");
    } else if (social === "error") {
      setMessage(params.get("msg") || "Connexion Facebook échouée.");
      window.history.replaceState({}, "", "/settings/business");
    }
  }, [load]);

  const connect = () => {
    window.location.href = `/api/social/meta/connect?storeId=${encodeURIComponent(storeId)}`;
  };

  const disconnect = async () => {
    if (!confirm("Déconnecter Facebook / Instagram de cette boutique ?")) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/social/meta/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        setMessage(data.error || "Déconnexion impossible.");
        return;
      }
      setMessage("Réseaux déconnectés.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
        <p className="text-sm text-gray-500">Chargement des réseaux sociaux…</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
      <h2 className="text-sm font-semibold">Réseaux sociaux</h2>
      <p className="text-xs text-gray-500">
        Connectez votre Page Facebook (et Instagram Pro lié) pour publier votre boutique ou un
        produit depuis l&apos;app.
      </p>

      {!status?.configured ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Publication sociale en cours d&apos;activation côté Wazo. Réessayez bientôt.
        </p>
      ) : null}

      {status?.connected ? (
        <div className="space-y-2 rounded-xl border border-[#075E54]/15 bg-[#F8FFFC] p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#075E54]">
            <Facebook className="h-4 w-4" />
            {status.pageName || "Page Facebook"}
          </p>
          <p className="flex items-center gap-2 text-xs text-gray-600">
            <Instagram className="h-3.5 w-3.5" />
            {status.instagram
              ? status.igUsername || "Instagram Pro lié"
              : "Instagram non lié à la Page (optionnel)"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            <Unlink className="mr-2 h-4 w-4" />
            Déconnecter
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          className="w-full bg-[#1877F2] hover:bg-[#166FE5]"
          disabled={!status?.configured || busy}
          onClick={connect}
        >
          <Link2 className="mr-2 h-4 w-4" />
          Connecter Facebook
        </Button>
      )}

      {message ? <p className="text-xs text-gray-600">{message}</p> : null}
    </section>
  );
}

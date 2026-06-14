"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Package } from "lucide-react";
import { PublicPortalLayout, portalSubmitButtonClass } from "@/components/PublicPortalLayout";
import { Input } from "@/components/ui/input";

export default function SuiviLandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/suivi/${encodeURIComponent(trimmed)}`);
  };

  return (
    <PublicPortalLayout
      icon={Package}
      badge="Portail public"
      title="Suivi colis Wazo"
      subtitle="Entrez le code reçu par SMS ou WhatsApp pour suivre votre livraison en temps réel."
      accent="green"
      proHint="Transporteur ?"
      proLinkLabel="Connexion à l'app"
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-[#1A1A1A]">
          Code de suivi
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: WZ1A2B3C4D"
            className="mt-2 text-center font-mono uppercase"
            required
          />
        </label>
        <button type="submit" className={portalSubmitButtonClass("green")}>
          Suivre mon colis
        </button>
      </form>
    </PublicPortalLayout>
  );
}

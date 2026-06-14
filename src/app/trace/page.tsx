"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Shield } from "lucide-react";
import { PublicPortalLayout, portalSubmitButtonClass } from "@/components/PublicPortalLayout";
import { Input } from "@/components/ui/input";

export default function TraceLandingPage() {
  const router = useRouter();
  const [hash, setHash] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = hash.trim();
    if (!trimmed) return;
    router.push(`/trace/${encodeURIComponent(trimmed.slice(0, 16))}`);
  };

  return (
    <PublicPortalLayout
      icon={Shield}
      badge="Blockchain Wazo"
      title="Traçabilité Wazo"
      subtitle="Vérifiez l'authenticité d'un produit enregistré sur la blockchain Wazo."
      accent="teal"
      proHint="Professionnel ?"
      proLinkLabel="Espace professionnel"
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-[#1A1A1A]">
          Référence hash
          <Input
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            placeholder="Collez la référence du produit"
            className="mt-2 font-mono text-sm"
            required
          />
        </label>
        <button type="submit" className={portalSubmitButtonClass("teal")}>
          Vérifier l&apos;authenticité
        </button>
      </form>
    </PublicPortalLayout>
  );
}

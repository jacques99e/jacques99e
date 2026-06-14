"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { GraduationCap } from "lucide-react";
import { PublicPortalLayout, portalSubmitButtonClass } from "@/components/PublicPortalLayout";
import { Input } from "@/components/ui/input";

export default function FormationLandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/formation/${encodeURIComponent(trimmed)}`);
  };

  return (
    <PublicPortalLayout
      icon={GraduationCap}
      badge="Formation en ligne"
      title="Formation Wazo"
      subtitle="Entrez le code reçu par WhatsApp ou de votre formateur pour accéder au cours."
      accent="orange"
      proHint="Formateur ?"
      proLinkLabel="Connexion à l'app"
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-[#1A1A1A]">
          Code invitation
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex: a1b2c3"
            className="mt-2 text-center font-mono"
            required
          />
        </label>
        <button type="submit" className={portalSubmitButtonClass("orange")}>
          Accéder au cours
        </button>
      </form>
    </PublicPortalLayout>
  );
}

"use client";

import { BookOpen, Calculator, ShoppingBasket, Sprout, TrendingUp } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AgricultureInsights } from "@/components/agriculture/AgricultureInsights";
import { ModuleMenuLink } from "@/components/ModuleMenuLink";
import { ModulePublicPortals } from "@/components/ModulePublicPortals";
import { useI18n } from "@/contexts/I18nContext";

const iconStyle = "bg-emerald-700/10 text-emerald-800";

export default function AgriculturePage() {
  const { t } = useI18n();

  return (
    <>
      <AppHeader title={t("modules.agriculture.title")} subtitle="Module" />
      <main className="app-page animate-fade-in space-y-3 pb-6">
        <ModulePublicPortals moduleId="agriculture" />
        <AgricultureInsights />

        <ModuleMenuLink
          href="/agriculture/cultures"
          icon={Sprout}
          title="Suivi des cultures"
          description="Parcelles, stades et suivi du semis"
          iconClassName={iconStyle}
        />
        <ModuleMenuLink
          href="/agriculture/intrants"
          icon={BookOpen}
          title="Journal des intrants"
          description="Engrais, pesticides, eau"
          iconClassName={iconStyle}
        />
        <ModuleMenuLink
          href="/agriculture/marches"
          icon={TrendingUp}
          title="Prix des marchés"
          description="Cacao, café, maïs, anacarde…"
          iconClassName={iconStyle}
        />
        <ModuleMenuLink
          href="/agriculture/rendement"
          icon={Calculator}
          title="Calculateur de rendement"
          description="kg récoltés / hectare et revenus"
          iconClassName={iconStyle}
        />
        <ModuleMenuLink
          href="/products/add?category=Agriculture"
          icon={ShoppingBasket}
          title="Vendre ma récolte"
          description="Créer rapidement un produit agricole"
          iconClassName={iconStyle}
        />
      </main>
    </>
  );
}

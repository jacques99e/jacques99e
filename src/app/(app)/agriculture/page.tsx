"use client";

import { BookOpen, BookMarked, Calculator, Calendar, ShoppingBasket, Sprout, TrendingUp } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AgricultureInsights } from "@/components/agriculture/AgricultureInsights";
import { ModuleCompetitiveEdge } from "@/components/ModuleCompetitiveEdge";
import { ModuleMenuLink } from "@/components/ModuleMenuLink";
import { ModulePublicPortals } from "@/components/ModulePublicPortals";
import { useI18n } from "@/contexts/I18nContext";

const iconStyle = "bg-emerald-700/10 text-emerald-800";

export default function AgriculturePage() {
  const { t } = useI18n();

  return (
    <>
      <AppHeader title={t("modules.agriculture.title")} subtitle={t("hub.module")} />
      <main className="app-page animate-fade-in space-y-3 pb-6">
        <ModulePublicPortals moduleId="agriculture" />
        <ModuleCompetitiveEdge moduleId="agriculture" />
        <AgricultureInsights />

        <ModuleMenuLink
          href="/agriculture/journal"
          icon={BookMarked}
          title="Journal de champ"
          description="Semis, traitements, récoltes — notes par parcelle"
          iconClassName={iconStyle}
        />
        <ModuleMenuLink
          href="/agriculture/calendrier"
          icon={Calendar}
          title={t("agri.menu.calendrier.title")}
          description={t("agri.menu.calendrier.desc")}
          iconClassName={iconStyle}
        />
        <ModuleMenuLink
          href="/agriculture/cultures"
          icon={Sprout}
          title={t("agri.menu.cultures.title")}
          description={t("agri.menu.cultures.desc")}
          iconClassName={iconStyle}
        />
        <ModuleMenuLink
          href="/agriculture/intrants"
          icon={BookOpen}
          title={t("agri.menu.intrants.title")}
          description={t("agri.menu.intrants.desc")}
          iconClassName={iconStyle}
        />
        <ModuleMenuLink
          href="/agriculture/marches"
          icon={TrendingUp}
          title={t("agri.menu.marches.title")}
          description={t("agri.menu.marches.desc")}
          iconClassName={iconStyle}
        />
        <ModuleMenuLink
          href="/agriculture/rendement"
          icon={Calculator}
          title={t("agri.menu.rendement.title")}
          description={t("agri.menu.rendement.desc")}
          iconClassName={iconStyle}
        />
        <ModuleMenuLink
          href="/agriculture/vendre"
          icon={ShoppingBasket}
          title={t("agri.menu.sell.title")}
          description={t("agri.menu.sell.desc")}
          iconClassName={iconStyle}
        />
      </main>
    </>
  );
}

import { listFieldJournal } from "@/lib/agriculture-journal";
import { readMarketPrices, type MarketPrice } from "@/lib/agriculture-markets";
import { localStore } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export type AgriDecisionType =
  | "harvest"
  | "sell"
  | "plant"
  | "weed"
  | "fertilize"
  | "log_journal"
  | "add_culture"
  | "weather";

export type AgriDecision = {
  id: string;
  type: AgriDecisionType;
  priority: number;
  title: string;
  reason: string;
  ctaLabel: string;
  href: string;
};

type CultureStage =
  | "préparation"
  | "semis"
  | "croissance"
  | "floraison"
  | "récolte";

type CulturePlot = {
  id: string;
  name: string;
  area: number;
  cropType: string;
  sowingDate: string;
  stage: CultureStage | string;
};

const CROP_TO_PRICE_ID: Record<string, string> = {
  cacao: "cacao",
  café: "cafe",
  cafe: "cafe",
  maïs: "mais",
  mais: "mais",
  riz: "riz",
  manioc: "manioc",
  arachide: "arachide",
  coton: "coton",
  mil: "mil",
};

/** Jours typiques avant récolte (indicatif Afrique de l'Ouest). */
const HARVEST_DAYS: Record<string, number> = {
  riz: 120,
  maïs: 90,
  mais: 90,
  mil: 90,
  manioc: 270,
  arachide: 100,
  coton: 150,
  cacao: 180,
  café: 210,
  cafe: 210,
  maraîcher: 45,
  maraicher: 45,
};

const DISMISS_KEY = "wazo_agri_decisions_dismissed";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO = todayISO()): number {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISO}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86400000);
}

function readCultures(): CulturePlot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("wazo_cultures");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CulturePlot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { date: string; ids: string[] };
    if (parsed.date !== todayISO()) return new Set();
    return new Set(parsed.ids || []);
  } catch {
    return new Set();
  }
}

export function dismissAgriDecision(id: string): void {
  if (typeof window === "undefined") return;
  const today = todayISO();
  let state = { date: today, ids: [] as string[] };
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { date: string; ids: string[] };
      if (parsed.date === today) state = parsed;
    }
  } catch {
    /* ignore */
  }
  if (!state.ids.includes(id)) state.ids.push(id);
  localStorage.setItem(DISMISS_KEY, JSON.stringify(state));
}

function matchPrice(cropType: string, prices: MarketPrice[]): MarketPrice | null {
  const key = CROP_TO_PRICE_ID[cropType.toLowerCase()] || cropType.toLowerCase();
  return (
    prices.find((p) => p.id === key) ||
    prices.find((p) => p.product.toLowerCase().includes(key)) ||
    null
  );
}

function harvestThreshold(cropType: string): number {
  return HARVEST_DAYS[cropType.toLowerCase()] || 100;
}

export function computeAgricultureDecisions(options?: {
  weatherAlert?: string | null;
  limit?: number;
}): AgriDecision[] {
  if (typeof window === "undefined") return [];

  const limit = options?.limit ?? 4;
  const dismissed = readDismissed();
  const cultures = readCultures();
  const prices = readMarketPrices();
  const storeId = localStore.get()?.id;
  const journal = listFieldJournal(storeId);
  const actions: AgriDecision[] = [];

  if (options?.weatherAlert) {
    actions.push({
      id: "weather-alert",
      type: "weather",
      priority: 1,
      title: "Alerte météo",
      reason: options.weatherAlert,
      ctaLabel: "Voir journal",
      href: "/agriculture/journal",
    });
  }

  if (!cultures.length) {
    actions.push({
      id: "add-culture",
      type: "add_culture",
      priority: 1,
      title: "Ajouter votre 1ère culture",
      reason: "Sans parcelle suivie, impossible de conseiller semis, récolte ou vente.",
      ctaLabel: "Ajouter",
      href: "/agriculture/cultures",
    });
  }

  for (const plot of cultures) {
    const days = plot.sowingDate ? daysBetween(plot.sowingDate) : 0;
    const stage = plot.stage;
    const threshold = harvestThreshold(plot.cropType);
    const price = matchPrice(plot.cropType, prices);

    const nearHarvest =
      stage === "récolte" ||
      stage === "floraison" ||
      (days > 0 && days >= threshold * 0.85);

    if (stage === "récolte" || (days >= threshold && stage !== "préparation")) {
      actions.push({
        id: `harvest-${plot.id}`,
        type: "harvest",
        priority: stage === "récolte" ? 1 : 2,
        title: `Récolter : ${plot.name}`,
        reason:
          stage === "récolte"
            ? `${plot.cropType} en stade récolte (${days} j depuis semis).`
            : `${plot.cropType} : ~${days} j — fenêtre de récolte probable.`,
        ctaLabel: "Journal",
        href: "/agriculture/journal",
      });
    }

    if (nearHarvest && price) {
      const trendHint =
        price.trend === "up"
          ? "Prix en hausse — bon moment pour vendre."
          : price.trend === "down"
            ? "Prix en baisse — vendez si stock prêt, sinon stockez."
            : "Prix stables sur le marché local.";
      actions.push({
        id: `sell-${plot.id}`,
        type: "sell",
        priority: price.trend === "up" ? 1 : 2,
        title: `Vendre ${plot.cropType} ?`,
        reason: `${price.product} : ${formatCurrency(price.priceFcfa)}/${price.unit}. ${trendHint}`,
        ctaLabel: "Vendre récolte",
        href: "/agriculture/vendre",
      });
    }

    if (stage === "préparation") {
      actions.push({
        id: `plant-${plot.id}`,
        type: "plant",
        priority: 2,
        title: `Semer : ${plot.name}`,
        reason: "Parcelle en préparation — planifiez le semis et notez-le au journal.",
        ctaLabel: "Calendrier",
        href: "/agriculture/calendrier",
      });
    }

    if (stage === "croissance" || stage === "semis") {
      if (days >= 14 && days <= 28) {
        actions.push({
          id: `weed-${plot.id}`,
          type: "weed",
          priority: 3,
          title: `Sarcler : ${plot.name}`,
          reason: `${days} j après semis — fenêtre typique de désherbage.`,
          ctaLabel: "Intrants",
          href: "/agriculture/intrants",
        });
      }
      if (days >= 21 && days <= 40) {
        actions.push({
          id: `fert-${plot.id}`,
          type: "fertilize",
          priority: 3,
          title: `Fertiliser : ${plot.name}`,
          reason: `${days} j après semis — apport d’engrais souvent utile.`,
          ctaLabel: "Intrants",
          href: "/agriculture/intrants",
        });
      }
    }

    const hasRecentLog = journal.some((e) => {
      const samePlot =
        e.parcel_label?.toLowerCase().includes(plot.name.toLowerCase()) ||
        e.parcel_label?.toLowerCase().includes(plot.cropType.toLowerCase());
      if (!samePlot) return false;
      return daysBetween(e.date) <= 10;
    });
    if (!hasRecentLog && stage !== "préparation") {
      actions.push({
        id: `log-${plot.id}`,
        type: "log_journal",
        priority: 4,
        title: `Noter l’activité : ${plot.name}`,
        reason: "Pas d’entrée journal récente — gardez la trace du champ.",
        ctaLabel: "Journal",
        href: "/agriculture/journal",
      });
    }
  }

  const unique = new Map<string, AgriDecision>();
  for (const a of actions.sort((x, y) => x.priority - y.priority)) {
    if (dismissed.has(a.id)) continue;
    if (!unique.has(a.id)) unique.set(a.id, a);
  }
  return [...unique.values()].slice(0, limit);
}

import { listFieldJournal } from "@/lib/agriculture-journal";
import { listAssets } from "@/lib/blockchain";
import { activePromotions } from "@/lib/commerce-promotions";
import { listCourses } from "@/lib/education";
import { overdueFollowUps } from "@/lib/health-followups";
import { readLocalProducts } from "@/lib/local-products";
import { readLocalSales } from "@/lib/local-sales";
import { listDeliveries } from "@/lib/logistics";
import type { ModuleId } from "@/types";

const STREAK_KEY = "wazo_engagement_streak";
const ACHIEVEMENTS_KEY = "wazo_engagement_achievements";
const LAST_VISIT_KEY = "wazo_engagement_last_visit";

export interface AchievementDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  { id: "first_sale", emoji: "💰", title: "Première vente", description: "Enregistrer votre première vente à la caisse" },
  { id: "sales_10", emoji: "🔥", title: "10 ventes", description: "Atteindre 10 ventes enregistrées" },
  { id: "first_product", emoji: "📦", title: "Catalogue lancé", description: "Ajouter votre premier produit" },
  { id: "streak_3", emoji: "⚡", title: "3 jours actifs", description: "Ouvrir l'app 3 jours d'affilée" },
  { id: "streak_7", emoji: "🏆", title: "Semaine champion", description: "7 jours d'affilée sur Wazo" },
  { id: "multi_module", emoji: "🧩", title: "Multi-activité", description: "Activer au moins 3 modules métier" },
  { id: "first_course", emoji: "🎓", title: "Formateur", description: "Créer votre premier cours" },
  { id: "first_delivery", emoji: "🚚", title: "Logisticien", description: "Planifier une première livraison" },
  { id: "first_trace", emoji: "🔗", title: "Traçabilité", description: "Enregistrer un actif blockchain" },
  { id: "field_journal", emoji: "🌾", title: "Journal de champ", description: "Noter une activité agricole" },
  { id: "promo_flash", emoji: "📣", title: "Promoteur", description: "Créer une promotion flash" },
];

export interface StreakState {
  current: number;
  best: number;
  visitedToday: boolean;
}

export interface TodayPulseItem {
  id: string;
  emoji: string;
  label: string;
  href?: string;
  tone: "success" | "warning" | "info";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getUnlockedAchievements(): string[] {
  return readJson<string[]>(ACHIEVEMENTS_KEY, []);
}

export function unlockAchievement(id: string): boolean {
  const unlocked = getUnlockedAchievements();
  if (unlocked.includes(id)) return false;
  writeJson(ACHIEVEMENTS_KEY, [...unlocked, id]);
  return true;
}

export function recordDailyVisit(): StreakState {
  const today = todayISO();
  const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
  const state = readJson<{ current: number; best: number; lastDate: string }>(STREAK_KEY, {
    current: 0,
    best: 0,
    lastDate: "",
  });

  if (lastVisit === today) {
    return { current: state.current, best: state.best, visitedToday: true };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().slice(0, 10);

  let current = 1;
  if (state.lastDate === yesterdayISO) {
    current = state.current + 1;
  } else if (state.lastDate === today) {
    current = state.current;
  }

  const best = Math.max(state.best, current);
  writeJson(STREAK_KEY, { current, best, lastDate: today });
  localStorage.setItem(LAST_VISIT_KEY, today);

  return { current, best, visitedToday: true };
}

export function getStreak(): StreakState {
  const state = readJson<{ current: number; best: number; lastDate: string }>(STREAK_KEY, {
    current: 0,
    best: 0,
    lastDate: "",
  });
  const today = todayISO();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const valid =
    state.lastDate === today || state.lastDate === yesterday.toISOString().slice(0, 10);
  return {
    current: valid ? state.current : 0,
    best: state.best,
    visitedToday: state.lastDate === today,
  };
}

export async function evaluateAchievements(
  storeId: string,
  activeModules: ModuleId[]
): Promise<AchievementDef[]> {
  const newly: AchievementDef[] = [];
  const tryUnlock = (id: string) => {
    if (unlockAchievement(id)) {
      const def = ACHIEVEMENT_CATALOG.find((a) => a.id === id);
      if (def) newly.push(def);
    }
  };

  const sales = readLocalSales(storeId);
  const products = readLocalProducts();
  const streak = getStreak();

  if (sales.length >= 1) tryUnlock("first_sale");
  if (sales.length >= 10) tryUnlock("sales_10");
  if (products.length >= 1) tryUnlock("first_product");
  if (streak.current >= 3) tryUnlock("streak_3");
  if (streak.current >= 7) tryUnlock("streak_7");
  if (activeModules.length >= 3) tryUnlock("multi_module");
  if (activePromotions(storeId).length > 0) tryUnlock("promo_flash");
  if (listFieldJournal(storeId).length > 0) tryUnlock("field_journal");

  if (activeModules.includes("education")) {
    const courses = await listCourses(storeId);
    if (courses.length > 0) tryUnlock("first_course");
  }
  if (activeModules.includes("logistics")) {
    const deliveries = await listDeliveries(storeId);
    if (deliveries.length > 0) tryUnlock("first_delivery");
  }
  if (activeModules.includes("blockchain")) {
    const assets = await listAssets(storeId);
    if (assets.length > 0) tryUnlock("first_trace");
  }

  return newly;
}

export async function buildTodayPulse(
  storeId: string,
  activeModules: ModuleId[],
  todaySalesCount: number,
  todaySalesTotal: number
): Promise<TodayPulseItem[]> {
  const items: TodayPulseItem[] = [];

  if (activeModules.includes("commerce")) {
    if (todaySalesCount > 0) {
      items.push({
        id: "sales",
        emoji: "💰",
        label: `${todaySalesCount} vente(s) aujourd'hui`,
        href: "/sales/history",
        tone: "success",
      });
    }
    const promos = activePromotions(storeId);
    if (promos.length) {
      items.push({
        id: "promos",
        emoji: "📣",
        label: `${promos.length} promo(s) active(s)`,
        href: "/sales/promotions",
        tone: "info",
      });
    }
  }

  const overdue = overdueFollowUps(storeId);
  if (overdue.length) {
    items.push({
      id: "followups",
      emoji: "🏥",
      label: `${overdue.length} rappel(s) patient en retard`,
      href: "/health/followups",
      tone: "warning",
    });
  }

  if (activeModules.includes("logistics")) {
    const deliveries = await listDeliveries(storeId);
    const pending = deliveries.filter(
      (d) => d.status !== "delivered" && d.status !== "cancelled"
    );
    if (pending.length) {
      items.push({
        id: "deliveries",
        emoji: "🚚",
        label: `${pending.length} livraison(s) en cours`,
        href: "/logistics",
        tone: "info",
      });
    }
  }

  if (activeModules.includes("education")) {
    const courses = await listCourses(storeId);
    const publicCourses = courses.filter((c) => c.is_public);
    if (publicCourses.length) {
      items.push({
        id: "courses",
        emoji: "🎓",
        label: `${publicCourses.length} cours public(s) actif(s)`,
        href: "/education",
        tone: "success",
      });
    }
  }

  if (!items.length && todaySalesTotal === 0) {
    items.push({
      id: "start",
      emoji: "🚀",
      label: "Belle journée pour avancer — choisissez une action rapide ci-dessous",
      tone: "info",
    });
  }

  return items;
}

export function achievementProgress(): { unlocked: number; total: number } {
  const unlocked = getUnlockedAchievements().length;
  return { unlocked, total: ACHIEVEMENT_CATALOG.length };
}

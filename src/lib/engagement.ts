import { listFieldJournal } from "@/lib/agriculture-journal";
import { listAssets } from "@/lib/blockchain";
import { activePromotions } from "@/lib/commerce-promotions";
import { listCourses, listModules } from "@/lib/education";
import { overdueFollowUps } from "@/lib/health-followups";
import { listDeliveries } from "@/lib/logistics";
import { readLocalClients } from "@/lib/local-clients";
import { readLocalSales } from "@/lib/local-sales";
import { getProducts } from "@/lib/products";
import { listPatients } from "@/lib/health";
import { listParcels } from "@/lib/agriculture";
import { readLocalAppointments } from "@/lib/offline-health";
import {
  ACHIEVEMENT_CATALOG,
  type AchievementDef,
} from "@/lib/achievements-catalog";
import type { ModuleId } from "@/types";

export { ACHIEVEMENT_CATALOG, BADGE_CATEGORIES } from "@/lib/achievements-catalog";
export type { AchievementDef, BadgeCategory } from "@/lib/achievements-catalog";

const STREAK_KEY = "wazo_engagement_streak";
const ACHIEVEMENTS_KEY = "wazo_engagement_achievements";
const LAST_VISIT_KEY = "wazo_engagement_last_visit";

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

function unlockMilestones(prefix: string, value: number, tryUnlock: (id: string) => void) {
  for (const badge of ACHIEVEMENT_CATALOG) {
    if (!badge.id.startsWith(`${prefix}_`)) continue;
    const threshold = Number(badge.id.slice(prefix.length + 1));
    if (Number.isFinite(threshold) && value >= threshold) {
      tryUnlock(badge.id);
    }
  }
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
  const salesTotal = sales.reduce(
    (sum, s) => sum + Number(s.total ?? s.total_amount ?? 0),
    0
  );
  const products = await getProducts(storeId);
  const streak = getStreak();
  const clients = readLocalClients(storeId);
  const promos = activePromotions(storeId);
  const journal = listFieldJournal(storeId);
  const deliveries = activeModules.includes("logistics") ? await listDeliveries(storeId) : [];
  const deliveredCount = deliveries.filter((d) => d.status === "delivered").length;
  const patients = activeModules.includes("health") ? await listPatients(storeId) : [];
  const appointments = readLocalAppointments(storeId);
  const courses = activeModules.includes("education") ? await listCourses(storeId) : [];
  const publicCourses = courses.filter((c) => c.is_public);
  const parcels = activeModules.includes("agriculture") ? await listParcels(storeId) : [];
  const assets = activeModules.includes("blockchain") ? await listAssets(storeId) : [];

  let lessonCount = 0;
  for (const course of courses.slice(0, 10)) {
    const modules = await listModules(course.id);
    lessonCount += modules.length;
  }

  unlockMilestones("sales", sales.length, tryUnlock);
  unlockMilestones("revenue", salesTotal, tryUnlock);
  unlockMilestones("products", products.length, tryUnlock);
  unlockMilestones("clients", clients.length, tryUnlock);
  unlockMilestones("promos", promos.length, tryUnlock);
  unlockMilestones("streak", streak.current, tryUnlock);
  unlockMilestones("courses", courses.length, tryUnlock);
  unlockMilestones("lessons", lessonCount, tryUnlock);
  unlockMilestones("deliveries", deliveries.length, tryUnlock);
  unlockMilestones("delivered", deliveredCount, tryUnlock);
  unlockMilestones("patients", patients.length, tryUnlock);
  unlockMilestones("appointments", appointments.length, tryUnlock);
  unlockMilestones("parcels", parcels.length, tryUnlock);
  unlockMilestones("journal", journal.length, tryUnlock);
  unlockMilestones("trace", assets.length, tryUnlock);

  if (activeModules.length >= 2) tryUnlock("multi_module_2");
  if (activeModules.length >= 3) tryUnlock("multi_module_3");
  if (activeModules.length >= 4) tryUnlock("multi_module_4");
  if (activeModules.length >= 5) tryUnlock("multi_module_5");

  for (const mod of activeModules) {
    tryUnlock(`mod_${mod}`);
  }

  if (publicCourses.length > 0) tryUnlock("public_course");
  if (sales.some((s) => s.payment_method === "credit")) tryUnlock("first_credit_sale");
  if (products.some((p) => p.stock_quantity > 0 && p.stock_quantity <= 5)) tryUnlock("low_stock_alert");
  if (overdueFollowUps(storeId).length > 0) tryUnlock("followup_active");
  if (parcels.some((p) => (p.harvested_kg ?? 0) > 0)) tryUnlock("harvest_logged");
  if (typeof localStorage !== "undefined" && localStorage.getItem("wazo_offline_sale")) {
    tryUnlock("offline_sale");
  }
  if (typeof localStorage !== "undefined" && localStorage.getItem("wazo_last_sync_ok")) {
    tryUnlock("sync_complete");
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

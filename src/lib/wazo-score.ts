import { readCulturalTasks } from "@/lib/agriculture-calendar";
import { readCreditLedger, totalOutstanding } from "@/lib/commerce-credit";
import { readAttendance } from "@/lib/education-attendance";
import { readPharmacyStock, lowStockItems } from "@/lib/health-pharmacy";
import { localStore } from "@/lib/db";
import { readLocalProducts } from "@/lib/local-products";
import { readLocalSales } from "@/lib/local-sales";
import type { ModuleId } from "@/types";

export interface WazoScoreBreakdown {
  overall: number;
  grade: "A+" | "A" | "B" | "C" | "D";
  modules: Partial<Record<ModuleId, number>>;
  signals: string[];
  actions: { label: string; href: string }[];
}

function gradeFromScore(score: number): WazoScoreBreakdown["grade"] {
  if (score >= 90) return "A+";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function commerceScore(storeId?: string): { score: number; signals: string[]; actions: WazoScoreBreakdown["actions"] } {
  const sales = readLocalSales(storeId);
  const products = readLocalProducts();
  const credit = readCreditLedger(storeId);
  const signals: string[] = [];
  const actions: WazoScoreBreakdown["actions"] = [];

  const weekAgo = Date.now() - 7 * 86400000;
  const recentSales = sales.filter((s) => {
    const d = new Date(s.date || s.created_at || 0);
    return d.getTime() >= weekAgo;
  });
  let score = 50;
  if (recentSales.length >= 7) {
    score += 25;
    signals.push("Rythme de vente solide cette semaine");
  } else if (recentSales.length > 0) {
    score += 10;
  } else {
    signals.push("Aucune vente enregistrée cette semaine");
    actions.push({ label: "Ouvrir la caisse", href: "/sales" });
  }

  const outOfStock = products.filter((p) => (p.stock ?? p.stock_quantity ?? 0) <= 0).length;
  if (outOfStock === 0) score += 15;
  else {
    score -= Math.min(15, outOfStock * 3);
    signals.push(`${outOfStock} produit(s) en rupture`);
    actions.push({ label: "Réapprovisionner", href: "/products" });
  }

  const outstanding = totalOutstanding(credit);
  if (outstanding > 0) {
    score -= 10;
    signals.push(`Créances clients : ${Math.round(outstanding).toLocaleString("fr-FR")} FCFA`);
    actions.push({ label: "Relancer les dettes", href: "/sales/credit" });
  }

  return { score: Math.max(0, Math.min(100, score)), signals, actions };
}

function agricultureScore(storeId?: string): { score: number; signals: string[]; actions: WazoScoreBreakdown["actions"] } {
  const tasks = readCulturalTasks(storeId);
  const signals: string[] = [];
  const actions: WazoScoreBreakdown["actions"] = [];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => !t.done && t.dueDate < today).length;
  const upcoming = tasks.filter((t) => !t.done && t.dueDate >= today).length;

  let score = 45;
  if (tasks.length >= 3) score += 20;
  if (upcoming >= 2) score += 15;
  if (overdue === 0) score += 20;
  else {
    score -= overdue * 8;
    signals.push(`${overdue} tâche(s) agricoles en retard`);
    actions.push({ label: "Calendrier cultural", href: "/agriculture/calendrier" });
  }
  if (tasks.length === 0) {
    signals.push("Planifiez vos cultures pour anticiper la récolte");
    actions.push({ label: "Agri Radar", href: "/agriculture/radar" });
  }

  return { score: Math.max(0, Math.min(100, score)), signals, actions };
}

function healthScore(storeId?: string): { score: number; signals: string[]; actions: WazoScoreBreakdown["actions"] } {
  const pharma = readPharmacyStock(storeId);
  const low = lowStockItems(pharma);
  const signals: string[] = [];
  const actions: WazoScoreBreakdown["actions"] = [];
  let score = 55;
  if (pharma.length >= 5) score += 20;
  if (low.length === 0 && pharma.length > 0) score += 25;
  else if (low.length > 0) {
    score -= low.length * 10;
    signals.push(`Pharmacie : ${low.length} médicament(s) en alerte`);
    actions.push({ label: "Mini pharmacie", href: "/health/pharmacie" });
  }
  actions.push({ label: "Sentinel communautaire", href: "/health/sentinel" });
  return { score: Math.max(0, Math.min(100, score)), signals, actions };
}

function educationScore(storeId?: string): { score: number; signals: string[]; actions: WazoScoreBreakdown["actions"] } {
  const records = readAttendance(storeId);
  const signals: string[] = [];
  const actions: WazoScoreBreakdown["actions"] = [];
  const present = records.filter((r) => r.present).length;
  const rate = records.length ? Math.round((present / records.length) * 100) : 0;
  let score = 50;
  if (records.length >= 10) score += 20;
  if (rate >= 80) {
    score += 30;
    signals.push(`Taux de présence excellent (${rate}%)`);
  } else if (records.length > 0) {
    score += rate / 5;
    signals.push(`Présence à ${rate}% — objectif 80%`);
    actions.push({ label: "Feuille de présence", href: "/education/presence" });
  } else {
    signals.push("Commencez l'émargement numérique");
    actions.push({ label: "Micro-badges", href: "/education/badges" });
  }
  return { score: Math.max(0, Math.min(100, score)), signals, actions };
}

export function computeWazoScore(activeModules: ModuleId[]): WazoScoreBreakdown {
  const storeId = localStore.get()?.id;
  const modules: Partial<Record<ModuleId, number>> = {};
  const signals: string[] = [];
  const actions: WazoScoreBreakdown["actions"] = [];
  const scorers: number[] = [];

  if (activeModules.includes("commerce")) {
    const r = commerceScore(storeId);
    modules.commerce = r.score;
    scorers.push(r.score);
    signals.push(...r.signals);
    actions.push(...r.actions);
  }
  if (activeModules.includes("agriculture")) {
    const r = agricultureScore(storeId);
    modules.agriculture = r.score;
    scorers.push(r.score);
    signals.push(...r.signals);
    actions.push(...r.actions);
  }
  if (activeModules.includes("health")) {
    const r = healthScore(storeId);
    modules.health = r.score;
    scorers.push(r.score);
    signals.push(...r.signals);
    actions.push(...r.actions);
  }
  if (activeModules.includes("education")) {
    const r = educationScore(storeId);
    modules.education = r.score;
    scorers.push(r.score);
    signals.push(...r.signals);
    actions.push(...r.actions);
  }
  if (activeModules.includes("logistics")) {
    modules.logistics = 70;
    scorers.push(70);
    signals.push("Fleet Pulse disponible pour optimiser vos livraisons");
    actions.push({ label: "Fleet Pulse", href: "/logistics/fleet" });
  }
  if (activeModules.includes("blockchain")) {
    modules.blockchain = 72;
    scorers.push(72);
    signals.push("Passeport produit prêt pour l'export international");
    actions.push({ label: "Passeport produit", href: "/blockchain/passport" });
  }

  const overall = scorers.length
    ? Math.round(scorers.reduce((a, b) => a + b, 0) / scorers.length)
    : 50;

  const uniqueActions = actions.filter(
    (a, i, arr) => arr.findIndex((x) => x.href === a.href) === i
  );

  return {
    overall,
    grade: gradeFromScore(overall),
    modules,
    signals: signals.slice(0, 5),
    actions: uniqueActions.slice(0, 4),
  };
}

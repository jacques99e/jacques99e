import { getBusinessSettings } from "@/lib/business-settings";
import { buildWhatsAppCatalog } from "@/lib/commerce-catalog";
import { localStore } from "@/lib/db";
import { readLocalClients } from "@/lib/local-clients";
import { readLocalProducts } from "@/lib/local-products";
import { readLocalSales } from "@/lib/local-sales";
import { buildMessageFromTemplate, openWhatsAppChat } from "@/lib/whatsapp";

export type DailyActionType =
  | "restock"
  | "relance_client"
  | "add_product_photo"
  | "share_catalog"
  | "first_product"
  | "first_sale"
  | "celebrate_growth";

export type DailyAction = {
  id: string;
  type: DailyActionType;
  priority: number;
  title: string;
  reason: string;
  ctaLabel: string;
  href?: string;
  whatsapp?: {
    phone?: string;
    templateId?: string;
    draftHint: string;
    prefilledMessage?: string;
  };
  entity?: { kind: "product" | "client"; id: string; name: string };
};

const DISMISS_KEY = "wazo_daily_actions_dismissed";
const MAX_ACTIONS = 3;
const DORMANT_DAYS = 14;

type DismissState = { date: string; ids: string[] };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function saleTotal(sale: { total?: number; total_amount?: number }): number {
  return Number(sale.total ?? sale.total_amount ?? 0);
}

function saleDateIso(sale: { date?: string; created_at?: string }): string {
  return sale.date || sale.created_at || "";
}

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as DismissState;
    if (parsed.date !== todayKey()) return new Set();
    return new Set(parsed.ids || []);
  } catch {
    return new Set();
  }
}

export function dismissDailyAction(id: string): void {
  if (typeof window === "undefined") return;
  const today = todayKey();
  let state: DismissState = { date: today, ids: [] };
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DismissState;
      if (parsed.date === today) state = parsed;
    }
  } catch {
    /* ignore */
  }
  if (!state.ids.includes(id)) state.ids.push(id);
  localStorage.setItem(DISMISS_KEY, JSON.stringify(state));
}

/** Produits locaux avec éventuelle image (champ non typé dans LocalProduct). */
function readProductsWithImages(): Array<{
  id: string;
  name: string;
  stock: number;
  price: number;
  image_url?: string | null;
}> {
  const products = readLocalProducts();
  let rawImages = new Map<string, string | null>();
  try {
    const raw = localStorage.getItem("wazo_products");
    if (raw) {
      const parsed = JSON.parse(raw) as Array<{
        id?: string;
        image_url?: string | null;
        photo_url?: string | null;
      }>;
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          if (!p.id) continue;
          rawImages.set(
            p.id,
            (p.image_url || p.photo_url || null) as string | null
          );
        }
      }
    }
  } catch {
    /* ignore */
  }
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    stock: p.stock ?? p.stock_quantity ?? 0,
    price: p.price,
    image_url: rawImages.get(p.id) ?? null,
  }));
}

function weekGrowthPercent(
  sales: ReturnType<typeof readLocalSales>
): number | null {
  const today = startOfDay(new Date());
  let week = 0;
  let prev = 0;
  const prevStart = new Date(today);
  prevStart.setDate(prevStart.getDate() - 13);
  const prevEnd = new Date(today);
  prevEnd.setDate(prevEnd.getDate() - 7);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  for (const sale of sales) {
    const raw = saleDateIso(sale);
    if (!raw) continue;
    const d = startOfDay(new Date(raw));
    if (Number.isNaN(d.getTime())) continue;
    const total = saleTotal(sale);
    if (d >= weekStart && d <= today) week += total;
    if (d >= prevStart && d < prevEnd) prev += total;
  }
  if (prev > 0) return Math.round(((week - prev) / prev) * 100);
  if (week > 0) return 100;
  return null;
}

function lastSaleDateForClient(
  sales: ReturnType<typeof readLocalSales>,
  clientId: string,
  phone?: string
): Date | null {
  let latest: Date | null = null;
  for (const sale of sales) {
    const match =
      sale.client_id === clientId ||
      (phone && (sale as { client_phone?: string }).client_phone === phone);
    if (!match) continue;
    const raw = saleDateIso(sale);
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    if (!latest || d > latest) latest = d;
  }
  return latest;
}

export function computeDailyActions(options?: {
  storeName?: string;
  limit?: number;
}): DailyAction[] {
  if (typeof window === "undefined") return [];

  const store = localStore.get();
  const storeId = store?.id;
  const storeName = options?.storeName || store?.name || "Wazo Digital";
  const slug = store?.slug;
  const limit = options?.limit ?? MAX_ACTIONS;
  const settings = getBusinessSettings();
  const threshold = settings.lowStockThreshold;
  const dismissed = readDismissed();

  const products = readProductsWithImages();
  const sales = readLocalSales(storeId || undefined);
  const clients = readLocalClients(storeId || undefined);
  const growth = weekGrowthPercent(sales);

  const weekStart = startOfDay(new Date());
  weekStart.setDate(weekStart.getDate() - 6);
  const weekSales = sales.filter((s) => {
    const raw = saleDateIso(s);
    if (!raw) return false;
    const d = startOfDay(new Date(raw));
    return !Number.isNaN(d.getTime()) && d >= weekStart;
  });

  const actions: DailyAction[] = [];
  const today = startOfDay(new Date());

  if (products.length === 0) {
    actions.push({
      id: "first-product",
      type: "first_product",
      priority: 1,
      title: "Ajouter votre 1er produit",
      reason: "Sans produit, pas de vente ni de boutique à partager.",
      ctaLabel: "Ajouter",
      href: "/products/add",
    });
  }

  const outOfStock = products.filter((p) => p.stock <= 0);
  for (const p of outOfStock.slice(0, 2)) {
    actions.push({
      id: `restock-out-${p.id}`,
      type: "restock",
      priority: 1,
      title: `Réapprovisionner ${p.name}`,
      reason: "En rupture de stock — ventes bloquées.",
      ctaLabel: "Voir stock",
      href: "/products",
      entity: { kind: "product", id: p.id, name: p.name },
    });
  }

  const lowStock = products.filter(
    (p) => p.stock > 0 && p.stock <= threshold
  );
  for (const p of lowStock.slice(0, 2)) {
    actions.push({
      id: `restock-low-${p.id}`,
      type: "restock",
      priority: 2,
      title: `Stock bas : ${p.name}`,
      reason: `${p.stock} unité(s) restante(s) (seuil ${threshold}).`,
      ctaLabel: "Voir stock",
      href: "/products",
      entity: { kind: "product", id: p.id, name: p.name },
    });
  }

  const dormantCutoff = new Date(today);
  dormantCutoff.setDate(dormantCutoff.getDate() - DORMANT_DAYS);

  const dormantClients = clients
    .filter((c) => c.phone?.trim())
    .map((c) => {
      const last = lastSaleDateForClient(sales, c.id, c.phone);
      const overdueFollowUp =
        c.nextFollowUp && startOfDay(new Date(c.nextFollowUp)) <= today;
      const isProspect = c.status === "prospect" || c.status === "relance";
      const isDormant = !last || last < dormantCutoff;
      const daysSince = last
        ? Math.floor((today.getTime() - last.getTime()) / 86400000)
        : null;
      return { client: c, last, overdueFollowUp, isProspect, isDormant, daysSince };
    })
    .filter((x) => x.overdueFollowUp || x.isProspect || x.isDormant)
    .sort((a, b) => {
      if (a.overdueFollowUp && !b.overdueFollowUp) return -1;
      if (!a.overdueFollowUp && b.overdueFollowUp) return 1;
      return (b.daysSince ?? 999) - (a.daysSince ?? 999);
    });

  for (const item of dormantClients.slice(0, 3)) {
    const { client, daysSince, overdueFollowUp, isProspect } = item;
    const reason = overdueFollowUp
      ? "Relance prévue pour aujourd’hui (ou en retard)."
      : isProspect && daysSince == null
        ? "Prospect sans achat — un message WhatsApp peut convertir."
        : daysSince != null
          ? `Pas d’achat depuis ${daysSince} jour(s).`
          : "Client à réactiver.";

    actions.push({
      id: `relance-${client.id}`,
      type: "relance_client",
      priority: overdueFollowUp ? 1 : 2,
      title: `Relancer ${client.name}`,
      reason,
      ctaLabel: "WhatsApp",
      href: "/clients",
      whatsapp: {
        phone: client.phone,
        templateId: "followup",
        draftHint: reason,
      },
      entity: { kind: "client", id: client.id, name: client.name },
    });
  }

  const withoutPhoto = products.filter((p) => !p.image_url);
  for (const p of withoutPhoto.slice(0, 2)) {
    actions.push({
      id: `photo-${p.id}`,
      type: "add_product_photo",
      priority: 3,
      title: `Ajouter une photo : ${p.name}`,
      reason: "Les photos vendent mieux sur WhatsApp et la boutique.",
      ctaLabel: "Ajouter",
      href: "/products",
      entity: { kind: "product", id: p.id, name: p.name },
    });
  }

  if (products.length > 0 && weekSales.length === 0) {
    const boutiqueUrl = slug
      ? `https://app.wazo-digital.com/boutique/${slug}`
      : undefined;
    const catalog = buildWhatsAppCatalog({
      storeName,
      products: readLocalProducts(),
      boutiqueUrl,
    });
    actions.push({
      id: "share-catalog",
      type: "share_catalog",
      priority: 4,
      title: "Partager le catalogue WhatsApp",
      reason: "Aucune vente sur 7 jours — relancez vos clients avec le catalogue.",
      ctaLabel: "Partager",
      whatsapp: {
        draftHint: "Partage catalogue",
        prefilledMessage: catalog,
      },
    });
  }

  if (products.length > 0 && sales.length === 0) {
    actions.push({
      id: "first-sale",
      type: "first_sale",
      priority: 2,
      title: "Enregistrer votre 1ère vente",
      reason: "Une vente active le suivi CA, stock et clients.",
      ctaLabel: "Nouvelle vente",
      href: "/sales",
    });
  }

  if (growth != null && growth >= 15 && products.length > 0) {
    const topName = products[0]?.name || "vos produits";
    const promo = buildMessageFromTemplate("promo", {
      clientName: "client",
      storeName,
      note: `Best-seller à mettre en avant : ${topName}`,
    });
    actions.push({
      id: "celebrate-growth",
      type: "celebrate_growth",
      priority: 5,
      title: `Belle dynamique (+${growth}%)`,
      reason: "Partagez une offre sur WhatsApp pour amplifier la semaine.",
      ctaLabel: "Promo WhatsApp",
      whatsapp: {
        templateId: "promo",
        draftHint: `Croissance +${growth}%`,
        prefilledMessage: promo.replace("Bonjour client,", "Bonjour,"),
      },
    });
  }

  const unique = new Map<string, DailyAction>();
  for (const a of actions.sort((a, b) => a.priority - b.priority)) {
    if (dismissed.has(a.id)) continue;
    if (!unique.has(a.id)) unique.set(a.id, a);
  }

  return [...unique.values()].slice(0, limit);
}

/** Construit le message local (template) sans ouvrir WhatsApp. */
export function buildDailyActionWhatsAppMessage(
  action: DailyAction,
  storeName: string
): string | null {
  const wa = action.whatsapp;
  if (!wa) return null;
  return (
    wa.prefilledMessage ||
    buildMessageFromTemplate(wa.templateId || "followup", {
      clientName: action.entity?.name || "client",
      storeName,
      note: wa.draftHint,
    })
  );
}

/** Ouvre WhatsApp avec un message fourni (ou template local). */
export function runDailyActionWhatsApp(
  action: DailyAction,
  storeName: string,
  messageOverride?: string
): boolean {
  const wa = action.whatsapp;
  if (!wa) return false;

  const message =
    messageOverride?.trim() ||
    buildDailyActionWhatsAppMessage(action, storeName) ||
    "";

  if (!message) return false;

  if (wa.phone) {
    return openWhatsAppChat(wa.phone, message);
  }

  window.open(
    `https://wa.me/?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer"
  );
  return true;
}

export function dailyActionsToRecommendationLines(
  actions: DailyAction[]
): string[] {
  if (!actions.length) {
    return [
      "Activité stable. Consultez vos analytics et exportez le rapport hebdo.",
    ];
  }
  return actions.map((a) => `${a.title} — ${a.reason}`);
}

/** Mappe une action du jour vers le type d'API draft-message. */
export function mapActionTypeToDraftType(
  actionType: DailyActionType
): "relance_client" | "promo" | "share_catalog" | "celebrate_growth" {
  switch (actionType) {
    case "share_catalog":
      return "share_catalog";
    case "celebrate_growth":
      return "celebrate_growth";
    case "relance_client":
      return "relance_client";
    default:
      return "relance_client";
  }
}

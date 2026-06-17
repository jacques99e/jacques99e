export type BadgeCategory =
  | "commerce"
  | "streak"
  | "education"
  | "logistics"
  | "health"
  | "agriculture"
  | "blockchain"
  | "general";

export interface AchievementDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  category: BadgeCategory;
}

const COMMERCE_EMOJIS = ["💰", "🛒", "💳", "🧾", "📈", "🏪", "💵", "🪙", "✨", "🎯"];
const STREAK_EMOJIS = ["⚡", "🔥", "🌟", "🏆", "💪", "📅", "🎖️", "👑"];
const EDU_EMOJIS = ["🎓", "📚", "✏️", "📝", "🧑‍🏫", "📖", "🎬", "🏫"];
const LOG_EMOJIS = ["🚚", "📦", "🗺️", "🛵", "🏍️", "🚛", "📍", "✅"];
const HEALTH_EMOJIS = ["🏥", "💊", "🩺", "❤️", "🧬", "🩹", "📋", "🫀"];
const AGRI_EMOJIS = ["🌾", "🌱", "🚜", "🌽", "🍅", "☀️", "🌧️", "🧺"];
const CHAIN_EMOJIS = ["🔗", "⛓️", "🔐", "📜", "🏷️", "🧾", "🌍", "✅"];
const GEN_EMOJIS = ["🚀", "🎉", "🧩", "📣", "🤝", "💡", "🌍", "⭐"];

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

function milestoneBadges(
  prefix: string,
  thresholds: number[],
  category: BadgeCategory,
  emojis: string[],
  titleFn: (n: number) => string,
  descFn: (n: number) => string
): AchievementDef[] {
  return thresholds.map((n, i) => ({
    id: `${prefix}_${n}`,
    emoji: pick(emojis, i),
    title: titleFn(n),
    description: descFn(n),
    category,
  }));
}

function buildCatalog(): AchievementDef[] {
  const badges: AchievementDef[] = [];

  badges.push(
    ...milestoneBadges(
      "sales",
      [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 300, 500],
      "commerce",
      COMMERCE_EMOJIS,
      (n) => (n === 1 ? "Première vente" : `${n} ventes`),
      (n) => `Enregistrer ${n} vente${n > 1 ? "s" : ""} à la caisse`
    ),
    ...milestoneBadges(
      "revenue",
      [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000],
      "commerce",
      COMMERCE_EMOJIS,
      (n) => `${(n / 1000).toLocaleString("fr-FR")}k FCFA`,
      (n) => `Atteindre ${n.toLocaleString("fr-FR")} FCFA de chiffre d'affaires cumulé`
    ),
    ...milestoneBadges(
      "products",
      [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100],
      "commerce",
      COMMERCE_EMOJIS,
      (n) => (n === 1 ? "Catalogue lancé" : `${n} produits`),
      (n) => `Avoir ${n} produit${n > 1 ? "s" : ""} dans votre catalogue`
    ),
    ...milestoneBadges(
      "clients",
      [1, 2, 3, 5, 10, 15, 20, 30, 50, 100],
      "commerce",
      COMMERCE_EMOJIS,
      (n) => (n === 1 ? "Premier client" : `${n} clients`),
      (n) => `Enregistrer ${n} client${n > 1 ? "s" : ""} CRM`
    ),
    ...milestoneBadges(
      "promos",
      [1, 2, 3, 5, 7, 10],
      "commerce",
      COMMERCE_EMOJIS,
      (n) => (n === 1 ? "Promoteur" : `${n} promos`),
      (n) => `Créer ${n} promotion${n > 1 ? "s" : ""} flash`
    ),
    ...milestoneBadges(
      "streak",
      [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 365],
      "streak",
      STREAK_EMOJIS,
      (n) => (n === 1 ? "Premier jour" : n === 7 ? "Semaine champion" : `${n} jours actifs`),
      (n) => `Ouvrir l'app ${n} jour${n > 1 ? "s" : ""} d'affilée`
    ),
    ...milestoneBadges(
      "courses",
      [1, 2, 3, 5, 7, 10, 15, 20],
      "education",
      EDU_EMOJIS,
      (n) => (n === 1 ? "Formateur" : `${n} cours`),
      (n) => `Créer ${n} cours de formation`
    ),
    ...milestoneBadges(
      "lessons",
      [1, 3, 5, 10, 15, 20, 30, 50],
      "education",
      EDU_EMOJIS,
      (n) => `${n} leçons`,
      (n) => `Publier ${n} module${n > 1 ? "s" : ""} de cours`
    ),
    ...milestoneBadges(
      "deliveries",
      [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 75, 100],
      "logistics",
      LOG_EMOJIS,
      (n) => (n === 1 ? "Logisticien" : `${n} livraisons`),
      (n) => `Planifier ${n} livraison${n > 1 ? "s" : ""}`
    ),
    ...milestoneBadges(
      "delivered",
      [1, 5, 10, 25, 50, 100],
      "logistics",
      LOG_EMOJIS,
      (n) => `${n} livrées`,
      (n) => `Marquer ${n} livraison${n > 1 ? "s" : ""} comme livrée${n > 1 ? "s" : ""}`
    ),
    ...milestoneBadges(
      "patients",
      [1, 2, 3, 5, 10, 15, 20, 30, 50],
      "health",
      HEALTH_EMOJIS,
      (n) => (n === 1 ? "Premier patient" : `${n} patients`),
      (n) => `Enregistrer ${n} patient${n > 1 ? "s" : ""}`
    ),
    ...milestoneBadges(
      "appointments",
      [1, 2, 3, 5, 10, 20, 30, 50],
      "health",
      HEALTH_EMOJIS,
      (n) => (n === 1 ? "Premier RDV" : `${n} rendez-vous`),
      (n) => `Planifier ${n} rendez-vous santé`
    ),
    ...milestoneBadges(
      "parcels",
      [1, 2, 3, 5, 7, 10, 15, 20],
      "agriculture",
      AGRI_EMOJIS,
      (n) => (n === 1 ? "Première parcelle" : `${n} parcelles`),
      (n) => `Enregistrer ${n} parcelle${n > 1 ? "s" : ""} agricoles`
    ),
    ...milestoneBadges(
      "journal",
      [1, 2, 3, 5, 7, 10, 15, 20, 30],
      "agriculture",
      AGRI_EMOJIS,
      (n) => (n === 1 ? "Journal de champ" : `${n} notes`),
      (n) => `Noter ${n} activité${n > 1 ? "s" : ""} au journal de champ`
    ),
    ...milestoneBadges(
      "trace",
      [1, 2, 3, 5, 7, 10, 15, 20, 30, 50],
      "blockchain",
      CHAIN_EMOJIS,
      (n) => (n === 1 ? "Traçabilité" : `${n} actifs`),
      (n) => `Enregistrer ${n} actif${n > 1 ? "s" : ""} de traçabilité`
    )
  );

  const modules: Array<{ id: ModuleBadgeId; emoji: string; title: string; description: string }> = [
    { id: "mod_commerce", emoji: "🏪", title: "Commerce activé", description: "Activer le module Commerce" },
    { id: "mod_education", emoji: "🎓", title: "Formation activée", description: "Activer le module Formation" },
    { id: "mod_logistics", emoji: "🚚", title: "Logistique activée", description: "Activer le module Logistique" },
    { id: "mod_health", emoji: "🏥", title: "Santé activée", description: "Activer le module Santé" },
    { id: "mod_agriculture", emoji: "🌾", title: "Agriculture activée", description: "Activer le module Agriculture" },
    { id: "mod_blockchain", emoji: "🔗", title: "Blockchain activée", description: "Activer le module Traçabilité" },
  ];
  for (const m of modules) {
    badges.push({ ...m, category: "general" });
  }

  badges.push(
    { id: "multi_module_2", emoji: "🧩", title: "Double activité", description: "Activer 2 modules métier", category: "general" },
    { id: "multi_module_3", emoji: "🧩", title: "Multi-activité", description: "Activer 3 modules métier", category: "general" },
    { id: "multi_module_4", emoji: "🎯", title: "Entrepreneur polyvalent", description: "Activer 4 modules métier", category: "general" },
    { id: "multi_module_5", emoji: "👑", title: "Empire Wazo", description: "Activer 5 modules métier ou plus", category: "general" },
    { id: "whatsapp_catalog", emoji: "📱", title: "Vitrine WhatsApp", description: "Partager votre catalogue WhatsApp", category: "general" },
    { id: "first_credit_sale", emoji: "🤝", title: "Vente à crédit", description: "Enregistrer une vente à crédit", category: "commerce" },
    { id: "low_stock_alert", emoji: "⚠️", title: "Stock vigilant", description: "Avoir au moins un produit en stock faible", category: "commerce" },
    { id: "restock_hero", emoji: "📦", title: "Réapprovisionné", description: "Remettre un produit en rupture en stock", category: "commerce" },
    { id: "public_course", emoji: "🌐", title: "Cours public", description: "Publier un cours en accès public", category: "education" },
    { id: "enrollment_first", emoji: "🧑‍🎓", title: "Premier inscrit", description: "Inscrire un élève à un cours", category: "education" },
    { id: "zone_created", emoji: "🗺️", title: "Zone de livraison", description: "Définir une zone logistique", category: "logistics" },
    { id: "followup_active", emoji: "📋", title: "Suivi actif", description: "Avoir des rappels patients à traiter", category: "health" },
    { id: "harvest_logged", emoji: "🧺", title: "Récolte notée", description: "Enregistrer une récolte sur une parcelle", category: "agriculture" },
    { id: "market_price", emoji: "💹", title: "Prix marché", description: "Consulter les prix marché agricoles", category: "agriculture" },
    { id: "qr_trace", emoji: "📲", title: "QR traçabilité", description: "Générer un QR de traçabilité", category: "blockchain" },
    { id: "team_member", emoji: "👥", title: "Équipe", description: "Inviter un membre dans votre boutique", category: "general" },
    { id: "billing_active", emoji: "💎", title: "Plan actif", description: "Avoir un abonnement Wazo actif", category: "general" },
    { id: "offline_sale", emoji: "📴", title: "Vente hors ligne", description: "Enregistrer une vente sans connexion", category: "general" },
    { id: "sync_complete", emoji: "☁️", title: "Synchronisé", description: "Synchroniser vos données vers le cloud", category: "general" }
  );

  return badges;
}

type ModuleBadgeId =
  | "mod_commerce"
  | "mod_education"
  | "mod_logistics"
  | "mod_health"
  | "mod_agriculture"
  | "mod_blockchain"
  | "mod_analytics";

export const ACHIEVEMENT_CATALOG: AchievementDef[] = buildCatalog();

export const BADGE_CATEGORIES: { id: BadgeCategory | "all"; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "commerce", label: "Commerce" },
  { id: "streak", label: "Série" },
  { id: "education", label: "Formation" },
  { id: "logistics", label: "Logistique" },
  { id: "health", label: "Santé" },
  { id: "agriculture", label: "Agriculture" },
  { id: "blockchain", label: "Traçabilité" },
  { id: "general", label: "Plateforme" },
];

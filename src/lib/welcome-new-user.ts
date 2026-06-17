const WELCOME_DISMISSED_KEY = "wazo_welcome_dismissed";
const FIRST_DASHBOARD_KEY = "wazo_first_dashboard_visit";

export function recordFirstDashboardVisit(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(FIRST_DASHBOARD_KEY)) {
    localStorage.setItem(FIRST_DASHBOARD_KEY, new Date().toISOString());
  }
}

export function dismissWelcomeBanner(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
}

export function shouldShowWelcomeBanner(salesCount: number): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(WELCOME_DISMISSED_KEY) === "1") return false;
  if (salesCount > 0) return false;

  const first = localStorage.getItem(FIRST_DASHBOARD_KEY);
  if (!first) return true;

  const days = (Date.now() - new Date(first).getTime()) / 86_400_000;
  return days < 14;
}

export const WELCOME_STEPS = [
  {
    emoji: "📦",
    title: "Ajoutez votre premier produit",
    description: "Nom, prix et stock — votre catalogue est prêt en 2 minutes.",
    href: "/products/add",
  },
  {
    emoji: "💰",
    title: "Enregistrez une vente",
    description: "Ouvrez la Caisse, ajoutez au panier et finalisez (même hors ligne).",
    href: "/sales",
  },
  {
    emoji: "📱",
    title: "Partagez sur WhatsApp",
    description: "Envoyez votre catalogue ou un reçu client en un clic.",
    href: "/products",
  },
] as const;

/**
 * Mission J0 — activation commerçant :
 * 1 produit → 1 partage WhatsApp → 1 vente.
 */

export type Day0StepId = "product" | "share" | "sale";

export const DAY0_DONE_KEY = "wazo_day0_mission_done";
export const DAY0_SHARE_KEY = "wazo_day0_share_done";

export const DAY0_STEPS: Array<{
  id: Day0StepId;
  title: string;
  description: string;
  href: string;
  cta: string;
}> = [
  {
    id: "product",
    title: "Ajoutez votre 1er produit",
    description: "Nom, prix et stock — 2 minutes. La photo est optionnelle.",
    href: "/products/add",
    cta: "Ajouter un produit",
  },
  {
    id: "share",
    title: "Partagez sur WhatsApp",
    description: "Envoyez votre catalogue ou publiez en Status pour vos clients.",
    href: "/products?share=1",
    cta: "Partager le catalogue",
  },
  {
    id: "sale",
    title: "Enregistrez une vente test",
    description: "Ouvrez la caisse et validez (Cash si moins de 200 FCFA).",
    href: "/sales",
    cta: "Ouvrir la caisse",
  },
];

export function isDay0MarkedDone(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(DAY0_DONE_KEY) === "1";
}

export function markDay0Complete(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DAY0_DONE_KEY, "1");
}

export function isDay0ShareDone(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DAY0_SHARE_KEY) === "1";
}

export function markDay0ShareDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DAY0_SHARE_KEY, "1");
}

export function getDay0Step(
  productsCount: number,
  salesCount: number
): Day0StepId | null {
  if (isDay0MarkedDone()) return null;
  // Déjà activés (produit + vente) : ne pas re-bloquer les pilotes existants.
  if (productsCount >= 1 && salesCount >= 1) return null;
  if (productsCount < 1) return "product";
  if (!isDay0ShareDone()) return "share";
  if (salesCount < 1) return "sale";
  return null;
}

export function isDay0MissionComplete(
  productsCount: number,
  salesCount: number
): boolean {
  if (isDay0MarkedDone()) return true;
  // Activation réelle = produit + vente (le partage WA accélère les nouveaux).
  return productsCount >= 1 && salesCount >= 1;
}

export function getDay0Progress(productsCount: number, salesCount: number) {
  const productDone = productsCount >= 1;
  const saleDone = salesCount >= 1;
  const shareDone = isDay0ShareDone();
  const done = [productDone, saleDone, shareDone].filter(Boolean).length;
  return {
    productDone,
    saleDone,
    shareDone,
    done,
    total: 3,
    current: getDay0Step(productsCount, salesCount),
  };
}

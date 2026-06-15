/** Conseils business rotatifs — tous modules. */
export const BUSINESS_TIPS = [
  "Relancez vos clients en retard de paiement depuis l'onglet Clients — un message WhatsApp suffit.",
  "Activez plusieurs modules : Commerce + Logistique + Formation couvrent 80 % des besoins.",
  "Partagez votre lien boutique sur WhatsApp Status chaque matin pour attirer des commandes.",
  "Une promo flash de -10 % le week-end peut doubler vos ventes — testez depuis Promotions.",
  "Notez chaque vente même hors ligne : la sync se fait automatiquement au retour du réseau.",
  "Les cours avec vidéo YouTube consomment moins de data qu'un upload MP4 pour vos apprenants.",
  "Consultez votre série de jours actifs sur le tableau de bord — la régularité paie.",
  "Exportez votre rapport hebdo en PDF (PRO) pour montrer vos résultats à un partenaire.",
  "Ancrez vos lots sur Celo pour rassurer les acheteurs export — certificat PDF en 1 clic.",
  "Planifiez vos zones de livraison avec tarifs fixes pour éviter les négociations au téléphone.",
] as const;

export function tipOfTheDay(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return BUSINESS_TIPS[day % BUSINESS_TIPS.length];
}

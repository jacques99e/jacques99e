import type { ModuleId } from "@/types";

const TIPS: Record<ModuleId | "general", string[]> = {
  general: [
    "Consultez votre score Nexus chaque lundi pour prioriser vos actions.",
    "Partagez votre catalogue WhatsApp le vendredi — pic d'achats en Afrique de l'Ouest.",
  ],
  commerce: [
    "Relancez les clients avec solde crédit avant le week-end.",
    "Utilisez la caisse vocale sur le marché quand vous n'avez pas les mains libres.",
    "Envoyez un lien MoMo pour encaisser à distance sans attendre le client.",
  ],
  agriculture: [
    "Vérifiez Agri Radar après chaque pluie forte sur vos cultures sensibles.",
    "Notez les prix marché le jour de la récolte pour négocier au mieux.",
  ],
  health: [
    "Programmez les rappels vaccinaux en début de mois dans Sentinel.",
    "Vérifiez le stock pharmacie chaque lundi matin.",
  ],
  logistics: [
    "Partagez la tournée groupée WhatsApp à 7h — vos chauffeurs gagnent 30 min.",
    "Estimez le carburant dans Fleet Pulse avant d'accepter une nouvelle zone.",
  ],
  education: [
    "Délivrez un micro-badge après chaque module — les apprenants partagent sur WhatsApp.",
    "Exportez les présences en PDF pour vos bailleurs en fin de mois.",
  ],
  blockchain: [
    "Imprimez le QR passeport sur chaque lot exporté — exigence acheteurs européens.",
    "Partagez le lien /trace avant l'expédition pour éviter les litiges.",
  ],
};

export function copilotTipsForModules(modules: ModuleId[], limit = 3): string[] {
  const pool = [...TIPS.general];
  for (const m of modules) pool.push(...(TIPS[m] ?? []));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

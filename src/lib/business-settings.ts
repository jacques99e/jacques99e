export const BUSINESS_SETTINGS_KEY = "wazo_business_settings";

export interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
}

export interface BusinessSettings {
  lowStockThreshold: number;
  monthlyRevenueTarget: number | null;
  defaultWhatsAppTemplateId: string;
  whatsappTemplates: WhatsAppTemplate[];
}

const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "followup",
    name: "Relance standard",
    body: `Bonjour {{clientName}},

C'est {{storeName}}. Nous souhaitions prendre de vos nouvelles et savoir si vous aviez besoin de quelque chose.
{{followUpLine}}{{noteLine}}
Merci et à bientôt.`,
  },
  {
    id: "followup_j1",
    name: "Séquence J+1",
    body: `Bonjour {{clientName}},

C'est {{storeName}}. Je voulais juste m'assurer que vous avez bien reçu nos infos.
Dites-moi si vous souhaitez commander ou si vous avez une question.
{{noteLine}}
Bonne journée !`,
  },
  {
    id: "followup_j3",
    name: "Séquence J+3",
    body: `Bonjour {{clientName}},

{{storeName}} ici. Je reviens vers vous rapidement : nos produits sont toujours disponibles.
Répondez à ce message pour réserver ou passer commande.
{{noteLine}}
Merci et à très bientôt.`,
  },
  {
    id: "promo",
    name: "Offre spéciale",
    body: `Bonjour {{clientName}},

{{storeName}} vous propose une offre limitée cette semaine. Répondez à ce message pour en profiter.
{{noteLine}}
À très vite !`,
  },
  {
    id: "thanks",
    name: "Remerciement",
    body: `Bonjour {{clientName}},

Merci pour votre confiance envers {{storeName}}. N'hésitez pas si vous avez une nouvelle commande.
{{noteLine}}`,
  },
];

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  lowStockThreshold: 5,
  monthlyRevenueTarget: null,
  defaultWhatsAppTemplateId: "followup",
  whatsappTemplates: DEFAULT_TEMPLATES,
};

function mergeWhatsAppTemplates(saved: WhatsAppTemplate[]): WhatsAppTemplate[] {
  const byId = new Map(saved.map((t) => [t.id, t]));
  for (const def of DEFAULT_TEMPLATES) {
    if (!byId.has(def.id)) byId.set(def.id, def);
  }
  return [...byId.values()];
}

export function getBusinessSettings(): BusinessSettings {
  if (typeof window === "undefined") return DEFAULT_BUSINESS_SETTINGS;
  try {
    const raw = localStorage.getItem(BUSINESS_SETTINGS_KEY);
    if (!raw) return DEFAULT_BUSINESS_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<BusinessSettings>;
    const templates =
      Array.isArray(parsed.whatsappTemplates) && parsed.whatsappTemplates.length > 0
        ? mergeWhatsAppTemplates(parsed.whatsappTemplates)
        : DEFAULT_TEMPLATES;
    const threshold = Number(parsed.lowStockThreshold);
    return {
      lowStockThreshold:
        Number.isFinite(threshold) && threshold >= 1 && threshold <= 500
          ? Math.round(threshold)
          : DEFAULT_BUSINESS_SETTINGS.lowStockThreshold,
      monthlyRevenueTarget:
        parsed.monthlyRevenueTarget != null && Number(parsed.monthlyRevenueTarget) > 0
          ? Number(parsed.monthlyRevenueTarget)
          : null,
      defaultWhatsAppTemplateId:
        parsed.defaultWhatsAppTemplateId || DEFAULT_BUSINESS_SETTINGS.defaultWhatsAppTemplateId,
      whatsappTemplates: templates,
    };
  } catch {
    return DEFAULT_BUSINESS_SETTINGS;
  }
}

export function saveBusinessSettings(next: BusinessSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUSINESS_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("wazo-business-settings-changed"));
}

export function getLowStockThreshold(): number {
  return getBusinessSettings().lowStockThreshold;
}

export const BUSINESS_SETTINGS_EVENT = "wazo-business-settings-changed";

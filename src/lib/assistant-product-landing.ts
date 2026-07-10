import { generateText } from "ai";
import {
  buildFallbackLanding,
  type ProductLandingContent,
} from "@/lib/product-landing";

const MODEL = process.env.ASSISTANT_MODEL?.trim() || "openai/gpt-5-mini";

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("JSON invalide");
  }
}

function normalizeContent(raw: unknown, fallback: ProductLandingContent): ProductLandingContent {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bullets = Array.isArray(obj.bullets)
    ? obj.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 5)
    : fallback.bullets;
  return {
    headline: String(obj.headline || fallback.headline).trim().slice(0, 80),
    subheadline: String(obj.subheadline || fallback.subheadline).trim().slice(0, 200),
    bullets: bullets.length ? bullets : fallback.bullets,
    cta: String(obj.cta || fallback.cta).trim().slice(0, 60),
    whatsappPitch: String(obj.whatsappPitch || fallback.whatsappPitch).trim().slice(0, 400),
    deliveryNote: String(obj.deliveryNote || fallback.deliveryNote).trim().slice(0, 200),
  };
}

export async function generateProductLanding(input: {
  name: string;
  description?: string | null;
  price: number;
  storeName: string;
}): Promise<{ content: ProductLandingContent; source: "ai" | "fallback"; error?: string }> {
  const fallback = buildFallbackLanding(input);

  if (process.env.ASSISTANT_SIMULATE === "true") {
    return { content: fallback, source: "fallback" };
  }

  try {
    const result = await generateText({
      model: MODEL,
      prompt: `Tu rédiges une mini page de vente pour un commerçant en Afrique francophone.

Produit: ${input.name}
Prix: ${input.price} FCFA
Description: ${input.description || "—"}
Boutique: ${input.storeName}

Réponds UNIQUEMENT avec JSON:
{
  "headline": "titre accrocheur max 60 car",
  "subheadline": "1-2 phrases vendeuses",
  "bullets": ["bénéfice 1", "bénéfice 2", "bénéfice 3"],
  "cta": "texte bouton court",
  "whatsappPitch": "message WhatsApp pour commander",
  "deliveryNote": "note livraison / paiement à la livraison"
}

Règles: français simple, pas de prix inventé autre que celui fourni, pas de markdown.`,
      maxOutputTokens: 450,
      temperature: 0.6,
    });

    const parsed = extractJson(result.text || "");
    return {
      content: normalizeContent(parsed, fallback),
      source: "ai",
    };
  } catch (err) {
    return {
      content: fallback,
      source: "fallback",
      error: err instanceof Error ? err.message : "Erreur IA",
    };
  }
}

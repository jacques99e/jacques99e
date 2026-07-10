import { generateText } from "ai";

export type ProductVisionSuggestion = {
  name: string;
  description: string;
  suggestedPriceFcfa: number | null;
  category: string | null;
  whatsappPitch: string | null;
};

const MODEL =
  process.env.ASSISTANT_VISION_MODEL?.trim() ||
  process.env.ASSISTANT_MODEL?.trim() ||
  "openai/gpt-5-mini";

const PROMPT = `Tu analyses une photo de produit pour un commerçant en Afrique francophone (Wazo Digital).

Réponds UNIQUEMENT avec un JSON valide (sans markdown) de la forme:
{
  "name": "nom court du produit (max 60 caractères)",
  "description": "description vendeuse 1-2 phrases en français simple",
  "suggestedPriceFcfa": null ou nombre entier estimé en FCFA si tu peux le déduire (sinon null),
  "category": "catégorie courte (ex: Alimentaire, Boisson, Cosmétique, Électronique, Mode, Autre)",
  "whatsappPitch": "message WhatsApp court 2-4 lignes pour vendre ce produit, sans inventer de prix si suggestedPriceFcfa est null"
}

Règles:
- Ne invente pas de marque si elle n'est pas lisible
- Si l'image n'est pas un produit clair, name = "Produit" et description = "Décrivez votre produit"
- Pas de texte hors JSON`;

function extractJsonObject(text: string): unknown {
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

function normalizeSuggestion(raw: unknown): ProductVisionSuggestion {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = String(obj.name || "Produit").trim().slice(0, 80) || "Produit";
  const description = String(obj.description || "").trim().slice(0, 400);
  const priceRaw = obj.suggestedPriceFcfa;
  const priceNum =
    typeof priceRaw === "number"
      ? priceRaw
      : typeof priceRaw === "string"
        ? Number(priceRaw.replace(/\D/g, ""))
        : NaN;
  const suggestedPriceFcfa =
    Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum) : null;
  const category = obj.category ? String(obj.category).trim().slice(0, 40) : null;
  const whatsappPitch = obj.whatsappPitch
    ? String(obj.whatsappPitch).trim().slice(0, 500)
    : null;

  return {
    name,
    description:
      description ||
      "Produit disponible. Contactez-nous pour commander.",
    suggestedPriceFcfa,
    category,
    whatsappPitch,
  };
}

export async function analyzeProductImage(params: {
  imageBytes: Uint8Array;
  mediaType: string;
}): Promise<{
  suggestion: ProductVisionSuggestion;
  source: "ai" | "fallback";
  error?: string;
}> {
  const fallback: ProductVisionSuggestion = {
    name: "Produit",
    description: "Décrivez votre produit pour vos clients.",
    suggestedPriceFcfa: null,
    category: "Autre",
    whatsappPitch: null,
  };

  if (process.env.ASSISTANT_SIMULATE === "true") {
    return { suggestion: fallback, source: "fallback" };
  }

  try {
    const result = await generateText({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image",
              image: params.imageBytes,
              mediaType: params.mediaType || "image/jpeg",
            },
          ],
        },
      ],
      maxOutputTokens: 400,
      temperature: 0.3,
    });

    const parsed = extractJsonObject(result.text || "");
    return {
      suggestion: normalizeSuggestion(parsed),
      source: "ai",
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erreur vision IA";
    return { suggestion: fallback, source: "fallback", error };
  }
}

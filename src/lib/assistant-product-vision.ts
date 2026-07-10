import { gateway, generateText } from "ai";

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
  "google/gemini-2.5-flash";

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
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
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
  const category = obj.category
    ? String(obj.category).trim().slice(0, 40)
    : null;
  const whatsappPitch = obj.whatsappPitch
    ? String(obj.whatsappPitch).trim().slice(0, 500)
    : null;

  return {
    name,
    description:
      description || "Produit disponible. Contactez-nous pour commander.",
    suggestedPriceFcfa,
    category,
    whatsappPitch,
  };
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function normalizeMediaType(mediaType: string): string {
  const t = (mediaType || "").toLowerCase().split(";")[0].trim();
  if (t === "image/jpg" || t === "image/pjpeg") return "image/jpeg";
  if (
    t === "image/jpeg" ||
    t === "image/png" ||
    t === "image/webp" ||
    t === "image/gif"
  ) {
    return t;
  }
  // HEIC / inconnu → on envoie comme jpeg (le client normalise en général)
  return "image/jpeg";
}

function humanizeAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || "");
  const lower = raw.toLowerCase();
  if (
    lower.includes("ai_gateway") ||
    lower.includes("gateway") ||
    lower.includes("unauthorized") ||
    lower.includes("api key") ||
    lower.includes("oidc")
  ) {
    return "Passerelle IA non configurée sur Vercel (AI Gateway). Activez-la ou ajoutez AI_GATEWAY_API_KEY.";
  }
  if (lower.includes("quota") || lower.includes("billing") || lower.includes("credit")) {
    return "Crédit IA épuisé. Vérifiez la facturation AI Gateway.";
  }
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return "Analyse trop longue. Réessayez avec une photo plus légère.";
  }
  if (lower.includes("unsupported") || lower.includes("media") || lower.includes("image")) {
    return "Format d’image non supporté. Utilisez une photo JPEG/PNG.";
  }
  return raw.slice(0, 220) || "Erreur vision IA";
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
    return {
      suggestion: fallback,
      source: "fallback",
      error: "Mode simulation IA (ASSISTANT_SIMULATE=true)",
    };
  }

  const mediaType = normalizeMediaType(params.mediaType);
  const dataUrl = `data:${mediaType};base64,${toBase64(params.imageBytes)}`;

  try {
    const result = await generateText({
      model: gateway(MODEL),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image",
              image: dataUrl,
            },
          ],
        },
      ],
      maxOutputTokens: 500,
      temperature: 0.2,
      providerOptions: {
        gateway: {
          models: [
            MODEL,
            "google/gemini-2.5-flash",
            "openai/gpt-5-mini",
          ],
        },
      },
    });

    const parsed = extractJsonObject(result.text || "");
    const suggestion = normalizeSuggestion(parsed);
    if (suggestion.name === "Produit" && !suggestion.description) {
      return { suggestion: fallback, source: "fallback", error: "Réponse IA vide" };
    }
    return { suggestion, source: "ai" };
  } catch (err) {
    return {
      suggestion: fallback,
      source: "fallback",
      error: humanizeAiError(err),
    };
  }
}

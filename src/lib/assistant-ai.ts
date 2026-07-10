import { gateway, generateText, type ModelMessage } from "ai";

/** Modèle texte par défaut (AI Gateway). */
export function getAssistantModel(): string {
  return process.env.ASSISTANT_MODEL?.trim() || "openai/gpt-5-mini";
}

/** Modèle vision / image. */
export function getVisionModel(): string {
  return (
    process.env.ASSISTANT_VISION_MODEL?.trim() ||
    process.env.ASSISTANT_MODEL?.trim() ||
    "google/gemini-2.5-flash"
  );
}

export function isAssistantSimulated(): boolean {
  return process.env.ASSISTANT_SIMULATE === "true";
}

export function humanizeAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || "");
  const lower = raw.toLowerCase();
  if (
    lower.includes("ai_gateway") ||
    lower.includes("gateway") ||
    lower.includes("unauthorized") ||
    lower.includes("api key") ||
    lower.includes("oidc") ||
    lower.includes("authentication")
  ) {
    return "Passerelle IA non configurée (AI Gateway). Vérifiez AI_GATEWAY_API_KEY sur Vercel.";
  }
  if (
    lower.includes("quota") ||
    lower.includes("billing") ||
    lower.includes("credit") ||
    lower.includes("budget")
  ) {
    return "Crédit / budget IA épuisé. Vérifiez AI Gateway sur Vercel.";
  }
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return "Requête IA trop longue. Réessayez.";
  }
  if (
    lower.includes("unsupported") ||
    lower.includes("media") ||
    lower.includes("image")
  ) {
    return "Format d’image non supporté. Utilisez JPEG/PNG.";
  }
  return raw.slice(0, 240) || "Erreur IA";
}

type GenerateOptions = {
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  fallbackModels?: string[];
} & (
  | { prompt: string; messages?: never }
  | { messages: ModelMessage[]; prompt?: never }
);

/**
 * Appel texte / vision via AI Gateway (AI_GATEWAY_API_KEY ou OIDC Vercel).
 */
export async function generateAssistantText(
  options: GenerateOptions
): Promise<string> {
  const modelId = options.model || getAssistantModel();
  const fallbacks = options.fallbackModels || [
    modelId,
    "openai/gpt-5-mini",
    "google/gemini-2.5-flash",
  ];

  const common = {
    model: gateway(modelId),
    maxOutputTokens: options.maxOutputTokens ?? 400,
    temperature: options.temperature ?? 0.5,
    providerOptions: {
      gateway: {
        models: [...new Set(fallbacks)],
      },
    },
  };

  const result =
    "messages" in options && options.messages
      ? await generateText({ ...common, messages: options.messages })
      : await generateText({ ...common, prompt: options.prompt });

  return (result.text || "").trim();
}

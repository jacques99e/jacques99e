import { generateText } from "ai";
import { buildMessageFromTemplate } from "@/lib/whatsapp";

export type DraftMessageType =
  | "relance_client"
  | "promo"
  | "credit_reminder"
  | "share_catalog"
  | "celebrate_growth";

export type DraftMessageInput = {
  type: DraftMessageType;
  storeName: string;
  clientName?: string;
  productName?: string;
  context?: string;
  boutiqueUrl?: string;
};

const MODEL = process.env.ASSISTANT_MODEL?.trim() || "openai/gpt-5-mini";

function typeLabel(type: DraftMessageType): string {
  switch (type) {
    case "relance_client":
      return "relance client (réactivation / suivi)";
    case "promo":
      return "offre promotionnelle courte";
    case "credit_reminder":
      return "rappel de crédit / paiement";
    case "share_catalog":
      return "partage de catalogue boutique";
    case "celebrate_growth":
      return "message promo pour capitaliser sur une belle semaine";
    default:
      return "message commercial";
  }
}

export function buildFallbackDraft(input: DraftMessageInput): string {
  const clientName = input.clientName?.trim() || "client";
  const storeName = input.storeName.trim() || "Wazo Digital";
  const note = [input.context, input.productName ? `Produit: ${input.productName}` : ""]
    .filter(Boolean)
    .join(" — ");

  if (input.type === "promo" || input.type === "celebrate_growth") {
    return buildMessageFromTemplate("promo", {
      clientName,
      storeName,
      note: note || undefined,
    });
  }

  if (input.type === "share_catalog") {
    const lines = [
      `*${storeName}* — Catalogue`,
      "",
      input.context || "Découvrez nos produits disponibles.",
    ];
    if (input.boutiqueUrl) {
      lines.push("", `Commander : ${input.boutiqueUrl}`);
    }
    lines.push("", "Répondez à ce message pour commander.");
    return lines.join("\n");
  }

  return buildMessageFromTemplate("followup", {
    clientName,
    storeName,
    note: note || undefined,
  });
}

function buildPrompt(input: DraftMessageInput): string {
  return `Tu rédiges un message WhatsApp pour un commerçant en Afrique francophone.

Type: ${typeLabel(input.type)}
Boutique: ${input.storeName}
Client: ${input.clientName || "(partage général, pas de prénom obligatoire)"}
Produit: ${input.productName || "—"}
Contexte métier: ${input.context || "—"}
Lien boutique: ${input.boutiqueUrl || "—"}

Règles:
- Français simple, chaleureux, professionnel
- 3 à 6 lignes max
- Pas d'emojis excessifs (0 à 2 max)
- Pas de markdown (pas d'astérisques pour le gras sauf *titre* boutique si utile)
- Inclure un appel à l'action clair (répondre / commander / passer)
- Ne invente pas de prix, stock ou promo non fournis
- Réponds UNIQUEMENT avec le texte du message, rien d'autre`;
}

export async function generateDraftMessage(
  input: DraftMessageInput
): Promise<{ message: string; source: "ai" | "fallback"; error?: string }> {
  const fallback = buildFallbackDraft(input);

  if (process.env.ASSISTANT_SIMULATE === "true") {
    return { message: fallback, source: "fallback" };
  }

  try {
    const result = await generateText({
      model: MODEL,
      prompt: buildPrompt(input),
      maxOutputTokens: 280,
      temperature: 0.7,
    });

    const message = (result.text || "").trim();
    if (!message || message.length < 20) {
      return { message: fallback, source: "fallback", error: "Réponse IA trop courte" };
    }
    return { message, source: "ai" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erreur IA";
    return { message: fallback, source: "fallback", error };
  }
}

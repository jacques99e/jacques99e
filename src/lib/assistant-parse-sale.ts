import {
  generateAssistantText,
  humanizeAiError,
  isAssistantSimulated,
} from "@/lib/assistant-ai";
import {
  detectPayment,
  parseSaleLocally,
  type CatalogProduct,
  type ParsedSaleItem,
  type ParsedSaleResult,
} from "@/lib/parse-sale-local";

export type { CatalogProduct, ParsedSaleItem, ParsedSaleResult };

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

export async function parseSaleWithAi(
  transcript: string,
  catalog: CatalogProduct[]
): Promise<ParsedSaleResult> {
  const local = parseSaleLocally(transcript, catalog);

  if (isAssistantSimulated()) {
    return local;
  }

  const catalogLines = catalog
    .slice(0, 40)
    .map((p) => `- ${p.name} (stock ${p.stock}, id:${p.id})`)
    .join("\n");

  try {
    const text = await generateAssistantText({
      maxOutputTokens: 400,
      temperature: 0.2,
      prompt: `Tu convertis une dictée de vente en JSON pour une caisse africaine francophone.

Catalogue:
${catalogLines || "(vide)"}

Dictée:
"""${transcript}"""

Réponds UNIQUEMENT avec JSON:
{
  "items": [{"productId":"id du catalogue","quantity":nombre entier}],
  "paymentMethod": "cash" | "momo" | "card" | null,
  "clientName": string | null
}

Règles:
- productId DOIT être un id du catalogue
- quantity >= 1, ne pas dépasser le stock
- Si aucun produit reconnu: items = []
- Pas de markdown`,
    });

    const parsed = extractJson(text) as {
      items?: Array<{ productId?: string; quantity?: number }>;
      paymentMethod?: string | null;
      clientName?: string | null;
    };

    const byId = new Map(catalog.map((p) => [p.id, p]));
    const items: ParsedSaleItem[] = [];
    for (const row of parsed.items || []) {
      const product = row.productId ? byId.get(row.productId) : undefined;
      if (!product || product.stock <= 0) continue;
      const quantity = Math.min(
        Math.max(1, Math.round(Number(row.quantity) || 1)),
        product.stock
      );
      items.push({
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice: product.price,
        confidence: 0.9,
      });
    }

    const payment =
      parsed.paymentMethod === "cash" ||
      parsed.paymentMethod === "momo" ||
      parsed.paymentMethod === "card"
        ? parsed.paymentMethod
        : detectPayment(transcript);

    if (!items.length) {
      return { ...local, source: local.items.length ? "local" : "ai" };
    }

    return {
      items,
      paymentMethod: payment,
      clientName: parsed.clientName?.trim() || null,
      unmatched: [],
      source: "ai",
      transcript,
    };
  } catch (err) {
    console.warn("[parse-sale-ai]", humanizeAiError(err));
    return local;
  }
}

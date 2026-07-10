export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export type ParsedSaleItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  confidence: number;
};

export type ParsedSaleResult = {
  items: ParsedSaleItem[];
  paymentMethod: "cash" | "momo" | "card" | null;
  clientName: string | null;
  unmatched: string[];
  source: "ai" | "local";
  transcript: string;
};

const FR_NUMBERS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  quinze: 15,
  vingt: 20,
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(productName: string, haystack: string): number {
  const p = normalize(productName);
  if (!p) return 0;
  if (haystack.includes(p)) return 1;
  const tokens = p.split(" ").filter((t) => t.length > 2);
  if (!tokens.length) return 0;
  const hit = tokens.filter((t) => haystack.includes(t)).length;
  return hit / tokens.length;
}

function bestProduct(
  catalog: CatalogProduct[],
  fragment: string
): { product: CatalogProduct; score: number } | null {
  const hay = normalize(fragment);
  let best: { product: CatalogProduct; score: number } | null = null;
  for (const product of catalog) {
    const score = scoreMatch(product.name, hay);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { product, score };
  }
  return best && best.score >= 0.4 ? best : null;
}

function extractQuantity(text: string): number {
  const digit = text.match(/\b(\d+)\b/);
  if (digit) return Math.max(1, Number(digit[1]));
  for (const [word, n] of Object.entries(FR_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return n;
  }
  return 1;
}

export function detectPayment(text: string): "cash" | "momo" | "card" | null {
  const n = normalize(text);
  if (/\b(momo|mobile money|orange money|wave|mtn)\b/.test(n)) return "momo";
  if (/\b(carte|card|visa)\b/.test(n)) return "card";
  if (/\b(espece|especes|cash|liquide)\b/.test(n)) return "cash";
  return null;
}

/** Parseur local rapide (sans IA) pour phrases simples. */
export function parseSaleLocally(
  transcript: string,
  catalog: CatalogProduct[]
): ParsedSaleResult {
  const normalized = normalize(transcript);
  const unmatched: string[] = [];
  const items: ParsedSaleItem[] = [];
  const used = new Set<string>();

  const ranked = catalog
    .map((p) => ({ product: p, score: scoreMatch(p.name, normalized) }))
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  for (const { product, score } of ranked) {
    if (used.has(product.id)) continue;
    const pname = normalize(product.name);
    const idx = normalized.indexOf(pname.split(" ")[0] || pname);
    const window =
      idx >= 0
        ? normalized.slice(Math.max(0, idx - 12), idx + pname.length + 8)
        : normalized;
    const quantity = Math.min(extractQuantity(window), Math.max(1, product.stock));
    if (product.stock <= 0) {
      unmatched.push(product.name);
      continue;
    }
    items.push({
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: product.price,
      confidence: score,
    });
    used.add(product.id);
  }

  if (!items.length) {
    const parts = transcript.split(/\bet\b|,|;|\+/i);
    for (const part of parts) {
      const match = bestProduct(catalog, part);
      if (!match) {
        if (part.trim()) unmatched.push(part.trim());
        continue;
      }
      if (used.has(match.product.id)) continue;
      const quantity = Math.min(
        extractQuantity(part),
        Math.max(1, match.product.stock)
      );
      items.push({
        productId: match.product.id,
        name: match.product.name,
        quantity,
        unitPrice: match.product.price,
        confidence: match.score,
      });
      used.add(match.product.id);
    }
  }

  return {
    items,
    paymentMethod: detectPayment(transcript),
    clientName: null,
    unmatched,
    source: "local",
    transcript,
  };
}

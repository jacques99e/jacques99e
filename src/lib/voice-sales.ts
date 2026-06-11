/** Parse une phrase vocale française type "deux sacs de riz cinq mille". */
export function parseVoiceSalePhrase(text: string): {
  quantity: number;
  productHint: string;
  amountFcfa: number | null;
} {
  const normalized = text.toLowerCase().trim();
  const numberWords: Record<string, number> = {
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
  };

  let quantity = 1;
  for (const [word, num] of Object.entries(numberWords)) {
    if (normalized.includes(word)) {
      quantity = num;
      break;
    }
  }
  const digitMatch = normalized.match(/(\d+)\s*(sacs?|kg|unités?|pièces?)?/);
  if (digitMatch) quantity = Number(digitMatch[1]);

  let amountFcfa: number | null = null;
  const amountPatterns = [
    /(\d[\d\s]*)\s*(fcfa|francs?)/,
    /(mille|deux mille|trois mille|quatre mille|cinq mille|dix mille)/,
  ];
  for (const pattern of amountPatterns) {
    const m = normalized.match(pattern);
    if (m) {
      if (m[1]?.includes("mille")) {
        const map: Record<string, number> = {
          mille: 1000,
          "deux mille": 2000,
          "trois mille": 3000,
          "quatre mille": 4000,
          "cinq mille": 5000,
          "dix mille": 10000,
        };
        amountFcfa = map[m[1]] ?? 1000;
      } else {
        amountFcfa = Number(m[1].replace(/\s/g, ""));
      }
      break;
    }
  }

  const productHint = normalized
    .replace(/\d+/g, "")
    .replace(
      /\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|sacs?|de|kg|fcfa|francs?|mille|vente|vendre)\b/g,
      ""
    )
    .trim();

  return { quantity, productHint: productHint || "produit", amountFcfa };
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export type PaymentMode = "simulate" | "test" | "live";

export function getPaymentMode(): PaymentMode {
  const raw = (process.env.PAYMENT_MODE || "simulate").toLowerCase();
  if (raw === "live" || raw === "test" || raw === "simulate") return raw;
  return "simulate";
}

export function getPaydunyaCheckoutCreateUrl(mode: PaymentMode): string {
  const base =
    mode === "live"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";
  return `${base}/checkout-invoice/create`;
}

function isPlaceholderKey(value: string | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!v) return true;
  if (/^\*+$/.test(v)) return true;
  if (v.toLowerCase().includes("your_") || v.toLowerCase().includes("placeholder")) return true;
  return false;
}

export function hasPaydunyaCredentials(): boolean {
  const master = process.env.PAYMENT_API_KEY?.trim() ?? "";
  const priv = process.env.PAYMENT_SECRET_KEY?.trim() ?? "";
  const token = process.env.PAYMENT_TOKEN?.trim() ?? "";
  return Boolean(master && priv && token && !isPlaceholderKey(master) && !isPlaceholderKey(priv) && !isPlaceholderKey(token));
}

export function validatePaydunyaKeys(): string | null {
  const master = process.env.PAYMENT_API_KEY?.trim() ?? "";
  const priv = process.env.PAYMENT_SECRET_KEY?.trim() ?? "";
  const token = process.env.PAYMENT_TOKEN?.trim() ?? "";

  if (isPlaceholderKey(master) || isPlaceholderKey(priv) || isPlaceholderKey(token)) {
    return "Cles PayDunya invalides: remplacez les etoiles (***) par les vraies cles du dashboard PayDunya > Integration API > Mode TEST.";
  }
  if (/^\d{32,}$/.test(master)) {
    return "PAYMENT_API_KEY invalide: la Master Key PayDunya contient des tirets (ex: wQzk9ZwR-...), pas seulement des chiffres.";
  }
  if (!master.includes("-")) {
    return "PAYMENT_API_KEY suspecte: verifiez que vous avez copie la Master Key TEST (format avec tirets).";
  }
  return null;
}

export function getPaymentEnvironmentLabel(mode: PaymentMode): string {
  if (mode === "simulate") return "Simulation interne (sans PayDunya)";
  if (mode === "test") return "PayDunya sandbox (cles de test, pas d'argent reel)";
  return "PayDunya production (paiements reels)";
}

export function getPaydunyaConfirmUrl(mode: PaymentMode, invoiceToken: string): string {
  const base =
    mode === "live"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";
  return `${base}/checkout-invoice/confirm/${encodeURIComponent(invoiceToken)}`;
}

export type PaydunyaConfirmResult = {
  ok: boolean;
  status: string;
  payload: Record<string, unknown>;
  error?: string;
};

function tokenFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.trim() && !value.startsWith("http")) {
    return value.trim();
  }
  return null;
}

function tokenFromCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("http")) return null;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    return last.length >= 8 ? last : null;
  } catch {
    return null;
  }
}

/** Token facture PayDunya (création, callback, ou URL checkout). */
export function extractPaydunyaInvoiceToken(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload || typeof payload !== "object") return null;
  const direct = tokenFromUnknown(payload.token ?? payload.invoice_token);
  if (direct) return direct;

  const invoice = payload.invoice;
  if (invoice && typeof invoice === "object") {
    const nested = tokenFromUnknown((invoice as { token?: unknown }).token);
    if (nested) return nested;
  }

  const paydunya = payload.paydunya;
  if (paydunya && typeof paydunya === "object") {
    const nested = extractPaydunyaInvoiceToken(paydunya as Record<string, unknown>);
    if (nested) return nested;
  }

  const data = payload.data;
  if (data && typeof data === "object") {
    const nested = extractPaydunyaInvoiceToken(data as Record<string, unknown>);
    if (nested) return nested;
  }

  return (
    tokenFromCheckoutUrl(payload.response_text) ||
    tokenFromCheckoutUrl(payload.url) ||
    tokenFromCheckoutUrl(payload.checkout_url)
  );
}

export function payloadWithInvoiceToken(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const token = extractPaydunyaInvoiceToken(payload);
  return token ? { ...payload, token } : payload;
}

export async function confirmPaydunyaInvoice(
  invoiceToken: string,
  mode: PaymentMode = getPaymentMode()
): Promise<PaydunyaConfirmResult> {
  const master = process.env.PAYMENT_API_KEY?.trim() ?? "";
  const priv = process.env.PAYMENT_SECRET_KEY?.trim() ?? "";
  const token = process.env.PAYMENT_TOKEN?.trim() ?? "";
  if (!master || !priv || !token) {
    return { ok: false, status: "error", payload: {}, error: "Cles PayDunya manquantes." };
  }

  const url = getPaydunyaConfirmUrl(mode, invoiceToken);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": master,
        "PAYDUNYA-PRIVATE-KEY": priv,
        "PAYDUNYA-TOKEN": token,
      },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const status = String(
      payload.status ?? (payload as { invoice?: { status?: string } }).invoice?.status ?? ""
    ).toLowerCase();
    const completed = status === "completed" || status === "paid";
    return { ok: completed, status: status || "unknown", payload };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Confirm PayDunya impossible.";
    return { ok: false, status: "error", payload: {}, error: message };
  }
}

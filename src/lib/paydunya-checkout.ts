import {
  getPaymentMode,
  getPaydunyaCheckoutCreateUrl,
  hasPaydunyaCredentials,
  validatePaydunyaKeys,
  type PaymentMode,
} from "@/lib/paydunya";

export interface PaydunyaCheckoutParams {
  amount: number;
  description: string;
  storeName: string;
  transactionId: string;
  returnPath: string;
  cancelPath: string;
}

export interface PaydunyaCheckoutResult {
  ok: boolean;
  checkoutUrl?: string;
  token?: string;
  responseCode?: string;
  error?: string;
  mode: PaymentMode;
  raw?: Record<string, unknown>;
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://wazo-digital.vercel.app").replace(/\/$/, "");
}

export function getPaydunyaConfirmUrl(mode: PaymentMode, token: string): string {
  const base =
    mode === "live"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";
  return `${base}/checkout-invoice/confirm/${encodeURIComponent(token)}`;
}

export interface PaydunyaConfirmResult {
  ok: boolean;
  status?: "completed" | "pending" | "cancelled" | string;
  responseCode?: string;
  raw?: Record<string, unknown>;
  error?: string;
}

export async function confirmPaydunyaInvoice(token: string): Promise<PaydunyaConfirmResult> {
  const mode = getPaymentMode();
  const apiKey = process.env.PAYMENT_API_KEY?.trim();
  if (!apiKey || mode === "simulate") {
    return { ok: false, error: "Confirmation indisponible en simulation." };
  }

  const keyError = validatePaydunyaKeys();
  if (keyError || !hasPaydunyaCredentials()) {
    return { ok: false, error: keyError ?? "Clés PayDunya incomplètes." };
  }

  try {
    const res = await fetch(getPaydunyaConfirmUrl(mode, token), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": apiKey,
        "PAYDUNYA-PRIVATE-KEY": process.env.PAYMENT_SECRET_KEY || "",
        "PAYDUNYA-TOKEN": process.env.PAYMENT_TOKEN || "",
      },
    });
    const data = (await res.json()) as Record<string, unknown>;
    const status = String(data.status ?? "").toLowerCase();
    const responseCode = String(data.response_code ?? "");
    const completed = status === "completed" || responseCode === "00";
    return {
      ok: completed,
      status: status || undefined,
      responseCode,
      raw: data,
    };
  } catch {
    return { ok: false, error: "Impossible de confirmer auprès de PayDunya." };
  }
}

export function buildPaydunyaCallbackUrl(transactionId: string): string {
  const callbackSecret = process.env.PAYMENT_CALLBACK_SECRET?.trim() ?? "";
  const query = new URLSearchParams({ tx: transactionId });
  if (callbackSecret) query.set("secret", callbackSecret);
  return `${appBaseUrl()}/api/payments/momo/callback?${query.toString()}`;
}

export async function createPaydunyaCheckoutInvoice(
  params: PaydunyaCheckoutParams
): Promise<PaydunyaCheckoutResult> {
  const mode = getPaymentMode();
  const apiKey = process.env.PAYMENT_API_KEY?.trim();

  if (mode === "simulate" || !apiKey) {
    const publicUrl = `${appBaseUrl()}${params.returnPath}`;
    return {
      ok: true,
      checkoutUrl: publicUrl,
      mode,
      responseCode: "SIM",
    };
  }

  const keyError = validatePaydunyaKeys();
  if (keyError || !hasPaydunyaCredentials()) {
    return { ok: false, error: keyError ?? "Clés PayDunya incomplètes.", mode };
  }

  const checkoutUrl = getPaydunyaCheckoutCreateUrl(mode);
  const base = appBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(checkoutUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": apiKey,
        "PAYDUNYA-PRIVATE-KEY": process.env.PAYMENT_SECRET_KEY || "",
        "PAYDUNYA-TOKEN": process.env.PAYMENT_TOKEN || "",
      },
      body: JSON.stringify({
        invoice: {
          total_amount: params.amount,
          description: params.description,
        },
        store: { name: params.storeName },
        actions: {
          callback_url: buildPaydunyaCallbackUrl(params.transactionId),
          return_url: `${base}${params.returnPath}`,
          cancel_url: `${base}${params.cancelPath}`,
        },
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    const link =
      typeof data.response_text === "string" && data.response_text.startsWith("http")
        ? data.response_text
        : typeof data.url === "string"
          ? data.url
          : undefined;

    const ok = data.response_code === "00" && Boolean(link);
    if (!ok) {
      const msg =
        typeof data.response_text === "string" && !data.response_text.startsWith("http")
          ? data.response_text
          : "PayDunya a refusé la création de la facture.";
      return { ok: false, error: String(msg), mode, responseCode: String(data.response_code ?? ""), raw: data };
    }

    return {
      ok: true,
      checkoutUrl: link,
      token: typeof data.token === "string" ? data.token : undefined,
      responseCode: String(data.response_code),
      mode,
      raw: data,
    };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "PayDunya ne répond pas (délai dépassé)."
        : "Impossible de joindre PayDunya.";
    return { ok: false, error: msg, mode };
  } finally {
    clearTimeout(timeout);
  }
}

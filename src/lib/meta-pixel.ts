declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackMetaEvent(
  event: string,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window === "undefined" || !window.fbq) return;
  if (params) window.fbq("track", event, params);
  else window.fbq("track", event);
}

function trackMetaCustom(
  event: string,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window === "undefined" || !window.fbq) return;
  if (params) window.fbq("trackCustom", event, params);
  else window.fbq("trackCustom", event);
}

function planValue(plan: string) {
  return plan === "business" ? 24.99 : 9.99;
}

export function trackMetaFirstProduct(name?: string) {
  trackMetaEvent("AddToCart", {
    content_name: name?.slice(0, 80) || "first_product",
    content_type: "product",
  });
}

/** Checkout client boutique — n’entraîne pas la campagne PRO. */
export function trackMetaMomoCheckout(value?: number) {
  trackMetaCustom("BoutiqueMoMoCheckout", {
    content_name: "boutique_momo",
    currency: "XOF",
    value: Number.isFinite(value) ? Number(value) : 0,
  });
}

export function trackMetaBoutiqueSale(value?: number) {
  trackMetaCustom("BoutiqueMoMo", {
    content_name: "boutique_momo",
    currency: "XOF",
    value: Number.isFinite(value) ? Number(value) : 0,
  });
}

export function trackMetaStartTrial(plan = "pro") {
  trackMetaEvent("StartTrial", {
    content_name: plan,
    content_category: "subscription",
    currency: "EUR",
    value: planValue(plan),
  });
}

export function trackMetaProCheckout(plan = "pro") {
  trackMetaEvent("InitiateCheckout", {
    content_name: plan,
    content_category: "subscription",
    currency: "EUR",
    value: planValue(plan),
  });
}

/** Achat abonnement Wazo uniquement (pas une vente boutique). */
export function trackMetaPurchase(value: number, contentName = "pro") {
  const isSub = contentName === "pro" || contentName === "business";
  trackMetaEvent("Purchase", {
    content_name: contentName,
    content_category: isSub ? "subscription" : "other",
    currency: isSub ? "EUR" : "XOF",
    value: isSub ? planValue(contentName) : Number.isFinite(value) ? Number(value) : 0,
  });
}

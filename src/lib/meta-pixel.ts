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

export function trackMetaFirstProduct(name?: string) {
  trackMetaEvent("AddToCart", {
    content_name: name?.slice(0, 80) || "first_product",
    content_type: "product",
  });
}

export function trackMetaMomoCheckout(value?: number) {
  trackMetaEvent("InitiateCheckout", {
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
    value: plan === "business" ? 24.99 : 9.99,
  });
}

export function trackMetaPurchase(value: number, contentName = "pro") {
  trackMetaEvent("Purchase", {
    content_name: contentName,
    currency: "XOF",
    value: Number.isFinite(value) ? Number(value) : 0,
  });
}

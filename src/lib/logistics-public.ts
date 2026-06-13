export function trackingUrl(code: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || "https://app.wazo-digital.com").replace(/\/$/, "");
  return `${base}/suivi/${encodeURIComponent(code)}`;
}

export function buildTrackingSms(params: {
  recipientName: string;
  trackingCode: string;
  trackingLink: string;
}): string {
  const name = params.recipientName.trim() || "Client";
  return (
    `Bonjour ${name}, votre colis Wazo est enregistre.\n` +
    `Code: ${params.trackingCode}\n` +
    `Suivi: ${params.trackingLink}`
  );
}

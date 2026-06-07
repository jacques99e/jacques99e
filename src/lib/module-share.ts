import { traceUrl } from "@/lib/blockchain-public";
import { formationUrl } from "@/lib/education-public";
import { trackingUrl } from "@/lib/logistics-public";
import { getWhatsAppLink } from "@/lib/utils";

export function openWhatsAppShare(phone: string | null | undefined, message: string) {
  if (!phone) return false;
  const url = getWhatsAppLink(phone, message);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export function shareDeliveryTracking(params: {
  phone?: string | null;
  recipientName: string;
  trackingCode: string;
}) {
  const link = trackingUrl(params.trackingCode);
  const message = `Bonjour ${params.recipientName}, suivez votre colis ici : ${link}\nCode : ${params.trackingCode}`;
  if (params.phone) return openWhatsAppShare(params.phone, message);
  void navigator.clipboard.writeText(`${message}`);
  return true;
}

export function shareCourseInvite(params: {
  courseTitle: string;
  inviteCode: string;
  storeName?: string;
}) {
  const link = formationUrl(params.inviteCode);
  const message =
    `📚 ${params.storeName || "Wazo Digital"} — Formation\n` +
    `Cours : ${params.courseTitle}\n` +
    `Accès : ${link}\n` +
    `Code : ${params.inviteCode}`;
  void navigator.clipboard.writeText(message);
  return message;
}

export function shareTraceLink(params: { assetName: string; hash: string }) {
  const link = traceUrl(params.hash);
  const message = `✅ Traçabilité Wazo — ${params.assetName}\nVérifier : ${link}`;
  void navigator.clipboard.writeText(message);
  return { link, message };
}

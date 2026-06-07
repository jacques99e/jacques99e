/** Build wa.me links and follow-up message templates for CRM. */



import {

  getBusinessSettings,

  type WhatsAppTemplate,

} from "@/lib/business-settings";



export function formatPhoneForWhatsApp(raw: string): string | null {

  const digits = raw.replace(/\D/g, "");

  if (!digits) return null;

  if (digits.startsWith("00")) return digits.slice(2);

  if (digits.startsWith("0") && digits.length >= 9) {

    return `225${digits.slice(1)}`;

  }

  return digits;

}



export function buildWhatsAppUrl(phone: string, message: string): string | null {

  const formatted = formatPhoneForWhatsApp(phone);

  if (!formatted) return null;

  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;

}



export interface WhatsAppMessageParams {

  clientName: string;

  storeName: string;

  note?: string;

  followUpDate?: string | null;

}



export function applyWhatsAppTemplate(

  body: string,

  params: WhatsAppMessageParams

): string {

  const { clientName, storeName, note, followUpDate } = params;

  const followUpLine = followUpDate

    ? `\nRappel prévu: ${followUpDate}.`

    : "";

  const noteLine = note?.trim() ? `\nNote: ${note.trim()}` : "";

  return body

    .replace(/\{\{clientName\}\}/g, clientName)

    .replace(/\{\{storeName\}\}/g, storeName)

    .replace(/\{\{followUpLine\}\}/g, followUpLine)

    .replace(/\{\{noteLine\}\}/g, noteLine)

    .trim();

}



export function getWhatsAppTemplateById(id: string): WhatsAppTemplate | undefined {

  return getBusinessSettings().whatsappTemplates.find((t) => t.id === id);

}



export function buildMessageFromTemplate(

  templateId: string | undefined,

  params: WhatsAppMessageParams

): string {

  const settings = getBusinessSettings();

  const id = templateId || settings.defaultWhatsAppTemplateId;

  const template =

    getWhatsAppTemplateById(id) ||

    settings.whatsappTemplates[0];

  if (template) {

    return applyWhatsAppTemplate(template.body, params);

  }

  return buildClientFollowUpMessage(params);

}



export function buildClientFollowUpMessage(params: WhatsAppMessageParams): string {

  return buildMessageFromTemplate("followup", params);

}



export function openWhatsAppChat(phone: string, message: string): boolean {

  const url = buildWhatsAppUrl(phone, message);

  if (!url) return false;

  window.open(url, "_blank", "noopener,noreferrer");

  return true;

}



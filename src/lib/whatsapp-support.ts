import { getWhatsAppLink } from "@/lib/utils";

/** Numéro support Jacques (Togo), sans + ni espaces. */
export const WHATSAPP_SUPPORT = "22893924040";
export const WHATSAPP_SUPPORT_DISPLAY = "+228 93 92 40 40";

export function whatsappSupportUrl(
  message = "Bonjour Jacques, j'ai besoin d'aide sur Wazo Digital."
): string {
  return getWhatsAppLink(WHATSAPP_SUPPORT, message);
}

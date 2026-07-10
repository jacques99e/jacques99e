import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { looksLikePhone } from "@/lib/sms";
import { sendWhatsAppMessage } from "@/lib/whatsapp-api";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    message?: string;
  };
  const phone = body.phone?.trim();
  if (!phone || !looksLikePhone(phone)) {
    return NextResponse.json(
      { success: false, error: "Numéro invalide" },
      { status: 400 }
    );
  }

  const message =
    body.message?.trim() ||
    "Test Wazo Digital — votre configuration WhatsApp Business API fonctionne.";

  const result = await sendWhatsAppMessage({ phone, message });
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, provider: result.provider },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    simulated: result.simulated ?? false,
    provider: result.provider,
    messageId: result.messageId,
    message: result.simulated
      ? "WhatsApp simulé (aucun envoi réel). Désactivez WHATSAPP_SIMULATE pour envoyer."
      : "Message WhatsApp de test envoyé.",
  });
}

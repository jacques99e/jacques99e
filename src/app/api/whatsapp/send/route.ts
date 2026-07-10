import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { looksLikePhone } from "@/lib/sms";
import {
  isWhatsAppApiConfigured,
  sendWhatsAppMessage,
  type WhatsAppTemplateSend,
} from "@/lib/whatsapp-api";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

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
    useTemplate?: boolean;
    templateName?: string;
    templateLanguage?: string;
    templateVariables?: Record<string, string>;
  };

  const phone = body.phone?.trim();
  if (!phone || !looksLikePhone(phone)) {
    return NextResponse.json(
      { success: false, error: "Numéro invalide" },
      { status: 400 }
    );
  }

  const message = body.message?.trim() || "";
  const fallbackUrl = buildWhatsAppUrl(phone, message || "Bonjour");

  if (!isWhatsAppApiConfigured()) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: "WhatsApp Business API non configurée",
        fallbackUrl,
      },
      { status: 503 }
    );
  }

  let template: WhatsAppTemplateSend | undefined;
  if (body.useTemplate || body.templateName) {
    const name =
      body.templateName?.trim() ||
      process.env.WHATSAPP_TEMPLATE_NAME?.trim() ||
      process.env.WHATSAPP_UTILITY_TEMPLATE?.trim();
    if (name) {
      template = {
        name,
        language:
          body.templateLanguage?.trim() ||
          process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() ||
          "fr",
        variables: body.templateVariables || (message ? { "1": message } : {}),
      };
    }
  }

  if (!message && !template) {
    return NextResponse.json(
      { success: false, error: "Message requis", configured: true },
      { status: 400 }
    );
  }

  const result = await sendWhatsAppMessage({
    phone,
    message: message || undefined,
    template,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        configured: true,
        error: result.error,
        fallbackUrl: result.fallbackUrl || fallbackUrl,
        provider: result.provider,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    configured: true,
    simulated: result.simulated ?? false,
    provider: result.provider,
    messageId: result.messageId,
  });
}

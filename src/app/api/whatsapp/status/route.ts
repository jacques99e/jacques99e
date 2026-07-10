import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import {
  getWhatsAppProvider,
  isWhatsAppApiConfigured,
} from "@/lib/whatsapp-api";

export async function GET() {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  const provider = getWhatsAppProvider();
  const simulate = provider === "simulate";
  const configured = isWhatsAppApiConfigured();

  return NextResponse.json({
    success: true,
    simulate,
    provider,
    configured,
    hasTemplate: Boolean(
      process.env.WHATSAPP_TEMPLATE_NAME?.trim() ||
        process.env.WHATSAPP_UTILITY_TEMPLATE?.trim()
    ),
  });
}

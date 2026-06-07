import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { looksLikePhone, sendSms } from "@/lib/sms";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as { phone?: string; message?: string };
  const phone = body.phone?.trim();
  if (!phone || !looksLikePhone(phone)) {
    return NextResponse.json({ success: false, error: "Numéro invalide" }, { status: 400 });
  }

  const message =
    body.message?.trim() ||
    "Test Wazo Digital — votre configuration SMS fonctionne correctement.";

  const result = await sendSms(phone, message);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    simulated: result.simulated ?? false,
    message: result.simulated
      ? "SMS simulé (aucun envoi réel). Désactivez SMS_SIMULATE pour envoyer."
      : "SMS de test envoyé.",
  });
}

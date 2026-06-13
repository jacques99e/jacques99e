import { NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { buildTrackingSms } from "@/lib/logistics-public";
import { createServiceSupabase } from "@/lib/supabase/server";
import { looksLikePhone, sendSms } from "@/lib/sms";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    delivery_id?: string;
  };
  const deliveryId = body.delivery_id?.trim();
  if (!deliveryId) {
    return NextResponse.json({ success: false, error: "delivery_id requis" }, { status: 400 });
  }

  try {
    const service = await createServiceSupabase();
    const { data: delivery } = await service
      .from("deliveries")
      .select("id, store_id, tracking_code, recipient_name, recipient_phone")
      .eq("id", deliveryId)
      .maybeSingle();

    if (!delivery) {
      return NextResponse.json({ success: false, error: "Livraison introuvable" }, { status: 404 });
    }

    const access = await checkStoreAccess(
      auth.serviceSupabase,
      auth.userId,
      delivery.store_id,
      "write"
    );
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const phone = delivery.recipient_phone?.trim();
    if (!phone || !looksLikePhone(phone)) {
      return NextResponse.json(
        { success: false, error: "Numéro destinataire invalide ou manquant" },
        { status: 400 }
      );
    }

    const base = (process.env.NEXT_PUBLIC_APP_URL || "https://app.wazo-digital.com").replace(
      /\/$/,
      ""
    );
    const link = `${base}/suivi/${delivery.tracking_code}`;
    const message = buildTrackingSms({
      recipientName: delivery.recipient_name,
      trackingCode: delivery.tracking_code,
      trackingLink: link,
    });

    const sms = await sendSms(phone, message);
    if (!sms.ok) {
      return NextResponse.json({ success: false, error: sms.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      simulated: sms.simulated ?? false,
      message: sms.simulated ? "SMS simulé" : "SMS de suivi envoyé au destinataire",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

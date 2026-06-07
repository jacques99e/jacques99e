import { NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";
import { looksLikePhone, sendSms } from "@/lib/sms";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as { appointment_id?: string };
  const appointmentId = body.appointment_id?.trim();
  if (!appointmentId) {
    return NextResponse.json({ success: false, error: "appointment_id requis" }, { status: 400 });
  }

  try {
    const service = await createServiceSupabase();
    const { data: appt } = await service
      .from("health_appointments")
      .select("id, store_id, scheduled_at, patient_id, health_patients(full_name, phone)")
      .eq("id", appointmentId)
      .maybeSingle();

    if (!appt) {
      return NextResponse.json({ success: false, error: "RDV introuvable" }, { status: 404 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, appt.store_id, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const patient = appt.health_patients as { full_name?: string; phone?: string } | null;
    const phone = patient?.phone?.trim();
    if (!phone || !looksLikePhone(phone)) {
      return NextResponse.json({ success: false, error: "Téléphone patient manquant" }, { status: 400 });
    }

    const when = new Date(appt.scheduled_at).toLocaleString("fr-FR");
    const name = patient?.full_name || "patient";
    const message = `Bonjour ${name}, rappel RDV Wazo Sante le ${when}. Merci de confirmer votre presence.`;

    const sms = await sendSms(phone, message);
    if (!sms.ok) {
      return NextResponse.json({ success: false, error: sms.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      simulated: sms.simulated ?? false,
      message: sms.simulated ? "SMS simulé" : "Rappel SMS envoyé",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente de collecte",
  picked_up: "Colis récupéré",
  in_transit: "En transit",
  delivered: "Livré",
  cancelled: "Annulé",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const trackingCode = decodeURIComponent(code).trim().toUpperCase();
  if (!trackingCode) {
    return NextResponse.json({ success: false, error: "Code invalide" }, { status: 400 });
  }

  try {
    const supabase = await createServiceSupabase();
    const { data, error } = await supabase
      .from("deliveries")
      .select("tracking_code, status, updated_at, created_at")
      .eq("tracking_code", trackingCode)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "Colis introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      delivery: {
        tracking_code: data.tracking_code,
        status: data.status,
        updated_at: data.updated_at,
        created_at: data.created_at,
        status_label: STATUS_LABELS[data.status as string] || data.status,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

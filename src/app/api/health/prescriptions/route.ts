import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { store_id, patient_id, medications, doctor_name } = body;
  if (!store_id || !patient_id || !medications) {
    return NextResponse.json({ error: "Donnees invalides pour creer l'ordonnance." }, { status: 400 });
  }
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, store_id, "write");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: patient } = await auth.serviceSupabase
    .from("health_patients")
    .select("id")
    .eq("id", patient_id)
    .eq("store_id", store_id)
    .maybeSingle();
  if (!patient) {
    return NextResponse.json({ error: "Patient introuvable pour cette boutique." }, { status: 404 });
  }

  const { data, error } = await auth.serviceSupabase
    .from("health_prescriptions")
    .insert({ store_id, patient_id, medications, doctor_name })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Impossible de creer l'ordonnance." }, { status: 500 });
  return NextResponse.json({ prescription: data });
}

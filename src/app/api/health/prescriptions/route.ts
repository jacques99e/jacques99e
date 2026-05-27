import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { store_id, patient_id, medications, doctor_name } = body;
  if (!store_id || !patient_id || !medications) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const supabase = await createServiceSupabase();
  const { data, error } = await supabase
    .from("health_prescriptions")
    .insert({ store_id, patient_id, medications, doctor_name })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prescription: data });
}

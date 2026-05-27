import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { generateLocalId } from "@/lib/sync";
import type { HealthAppointment, HealthPatient, HealthVital } from "@/types";

export async function listPatients(storeId: string): Promise<HealthPatient[]> {
  if (db) {
    const local = await db.healthPatients.where("store_id").equals(storeId).toArray();
    if (local.length || !navigator.onLine) return local;
  }
  if (!navigator.onLine) return [];
  const { data } = await supabase.from("health_patients").select("*").eq("store_id", storeId);
  if (data && db) await db.healthPatients.bulkPut(data);
  return data || [];
}

export async function savePatient(
  storeId: string,
  patient: Partial<HealthPatient> & { full_name: string }
): Promise<HealthPatient> {
  const localId = patient.id || generateLocalId();
  const record: HealthPatient = {
    id: localId,
    store_id: storeId,
    full_name: patient.full_name,
    age: patient.age ?? null,
    blood_group: patient.blood_group ?? null,
    allergies: patient.allergies ?? null,
    medical_history: patient.medical_history ?? null,
    phone: patient.phone ?? null,
    _localId: localId.startsWith("local-") ? localId : undefined,
    _pendingSync: true,
  };
  if (db) await db.healthPatients.put(record);
  if (navigator.onLine) {
    const { data } = await supabase
      .from("health_patients")
      .upsert({
        id: localId.startsWith("local-") ? undefined : localId,
        store_id: storeId,
        full_name: record.full_name,
        age: record.age,
        blood_group: record.blood_group,
        allergies: record.allergies,
        medical_history: record.medical_history,
        phone: record.phone,
      })
      .select()
      .single();
    if (data) {
      record.id = data.id;
      record._pendingSync = false;
      if (db) await db.healthPatients.put(record);
    }
  }
  return record;
}

export async function listAppointments(storeId: string): Promise<HealthAppointment[]> {
  if (!navigator.onLine) return [];
  const { data } = await supabase
    .from("health_appointments")
    .select("*")
    .eq("store_id", storeId)
    .gte("scheduled_at", new Date().toISOString().split("T")[0]);
  return data || [];
}

export async function listVitals(patientId: string): Promise<HealthVital[]> {
  if (!navigator.onLine) return [];
  const { data } = await supabase
    .from("health_vitals")
    .select("*")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false });
  return data || [];
}

export async function saveVital(vital: Omit<HealthVital, "id">): Promise<void> {
  if (!navigator.onLine) return;
  await supabase.from("health_vitals").insert(vital);
}

export async function generatePrescriptionPdf(
  patientName: string,
  medications: { name: string; dosage: string }[],
  doctorName: string
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Ordonnance — Wazo Santé", 20, 20);
  doc.setFontSize(10);
  doc.text(`Patient: ${patientName}`, 20, 35);
  doc.text(`Praticien: ${doctorName}`, 20, 42);
  let y = 55;
  medications.forEach((m) => {
    doc.text(`• ${m.name} — ${m.dosage}`, 20, y);
    y += 8;
  });
  doc.text("Cachet et signature", 20, y + 15);
  return doc.output("blob");
}

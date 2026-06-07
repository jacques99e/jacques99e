"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { db } from "@/lib/db";
import { downloadCsv } from "@/lib/export";
import { listVitals, saveVital, generatePrescriptionPdf } from "@/lib/health";
import { getWhatsAppLink } from "@/lib/utils";
import type { HealthPatient, HealthVital } from "@/types";

export default function PatientDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [patient, setPatient] = useState<HealthPatient | null>(null);
  const [vitals, setVitals] = useState<HealthVital[]>([]);
  const [weight, setWeight] = useState("");
  const [bp, setBp] = useState("");
  const [temp, setTemp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (db) db.healthPatients.get(id).then((p) => setPatient(p ?? null));
    listVitals(id).then(setVitals);
  }, [id]);

  const addVital = async () => {
    setError("");
    setNotice("");
    const parsedWeight = weight ? Number(weight) : null;
    const parsedTemp = temp ? Number(temp) : null;
    if ((parsedWeight !== null && !Number.isFinite(parsedWeight)) || (parsedTemp !== null && !Number.isFinite(parsedTemp))) {
      setError("Valeurs de constantes invalides.");
      return;
    }
    await saveVital({
      patient_id: id,
      weight_kg: parsedWeight,
      blood_pressure: bp || null,
      temperature_c: parsedTemp,
    });
    setWeight("");
    setBp("");
    setTemp("");
    setNotice("Constantes enregistrées.");
    listVitals(id).then(setVitals);
  };

  const exportRx = async () => {
    if (!patient) return;
    const blob = await generatePrescriptionPdf(patient.full_name, [
      { name: "Paracétamol", dosage: "500mg 2x/jour" },
    ], "Dr. Wazo");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ordonnance-${patient.full_name}.pdf`;
    a.click();
  };

  const teleconsult = () => {
    if (patient?.phone) {
      window.open(getWhatsAppLink(patient.phone, `Consultation ${patient.full_name}`), "_blank");
    }
  };

  const exportVitals = () => {
    if (!patient) return;
    downloadCsv(
      `constantes-${patient.full_name}-${new Date().toISOString().slice(0, 10)}.csv`,
      vitals.map((v) => ({
        recorded_at: v.recorded_at ?? "",
        weight_kg: v.weight_kg ?? "",
        blood_pressure: v.blood_pressure ?? "",
        temperature_c: v.temperature_c ?? "",
      }))
    );
  };

  if (!patient) return <p className="p-4">{t("common.loading")}</p>;

  return (
    <>
      <AppHeader title={patient.full_name} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 text-sm space-y-1">
          <p>{t("health.age")}: {patient.age ?? "—"}</p>
          <p>{t("health.blood")}: {patient.blood_group ?? "—"}</p>
          <p>{t("health.allergies")}: {patient.allergies ?? "—"}</p>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 space-y-3">
          <h2 className="font-medium">{t("health.vitals")}</h2>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="kg" value={weight} onChange={(e) => setWeight(e.target.value)} />
            <Input placeholder="TA" value={bp} onChange={(e) => setBp(e.target.value)} />
            <Input placeholder="°C" value={temp} onChange={(e) => setTemp(e.target.value)} />
          </div>
          <Button size="sm" onClick={addVital}>{t("common.save")}</Button>
          {notice ? <p className="text-xs text-green-700">{notice}</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <ul className="text-xs space-y-1">
            {vitals.map((v) => (
              <li key={v.id}>
                {v.recorded_at?.slice(0, 10)} — {v.weight_kg}kg, {v.blood_pressure}, {v.temperature_c}°C
              </li>
            ))}
          </ul>
        </section>

        <Button asChild variant="outline" className="w-full">
          <Link href={`/health/appointments/new?patient=${encodeURIComponent(id)}`}>
            <Calendar className="h-4 w-4" />
            Planifier un rendez-vous
          </Link>
        </Button>
        <Button variant="outline" className="w-full" onClick={exportVitals}>
          Export constantes CSV
        </Button>
        <Button variant="outline" className="w-full" onClick={exportRx}>{t("health.prescription")}</Button>
        <Button className="w-full" onClick={teleconsult}>{t("health.teleconsult")}</Button>
      </main>
    </>
  );
}

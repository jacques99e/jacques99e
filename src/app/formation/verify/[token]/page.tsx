"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Award, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";

interface VerifyPayload {
  valid: boolean;
  certificate?: {
    student_name: string;
    course_title: string;
    organization_name?: string;
    progress_percent: number;
    completed_at: string | null;
    token: string;
    certificate_id?: string;
  };
  error?: string;
}

export default function CertificateVerifyPage() {
  const params = useParams();
  const token = decodeURIComponent(params.token as string).trim();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<VerifyPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/education/certificates/verify/${encodeURIComponent(token)}`);
        const json = (await res.json()) as VerifyPayload & { success: boolean };
        if (!cancelled) {
          if (res.ok && json.certificate) {
            setPayload({ valid: json.valid, certificate: json.certificate });
          } else {
            setPayload({ valid: false, error: json.error || "Certificat introuvable" });
          }
        }
      } catch {
        if (!cancelled) setPayload({ valid: false, error: "Erreur de vérification" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0]">
        <Loader2 className="h-8 w-8 animate-spin text-[#075E54]" />
      </main>
    );
  }

  const valid = payload?.valid && payload.certificate;
  const cert = payload?.certificate;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0] px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="bg-[#075E54] px-6 py-4 text-center text-white">
          <p className="text-xs font-medium tracking-wide opacity-90">WAZO DIGITAL</p>
          <p className="text-sm font-semibold">Vérification de certificat</p>
        </div>

        <div className="p-6">
          <div className="mb-4 flex justify-center">
            {valid ? (
              <CheckCircle2 className="h-14 w-14 text-green-600" />
            ) : (
              <XCircle className="h-14 w-14 text-red-500" />
            )}
          </div>

          <h1 className="text-center text-lg font-bold text-gray-900">
            {valid ? "Certificat authentique et valide" : "Certificat non valide"}
          </h1>

          {valid && cert ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="flex items-center gap-2 font-medium text-green-800">
                  <Award className="h-4 w-4" />
                  {cert.student_name}
                </p>
                <p className="mt-2 text-gray-700">
                  <span className="text-gray-500">Formation :</span> {cert.course_title}
                </p>
                {cert.organization_name ? (
                  <p className="text-gray-700">
                    <span className="text-gray-500">Organisme :</span> {cert.organization_name}
                  </p>
                ) : null}
                <p className="text-gray-600">Progression : {cert.progress_percent}%</p>
                {cert.completed_at ? (
                  <p className="text-gray-600">
                    Délivré le :{" "}
                    {new Date(cert.completed_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
                {cert.certificate_id ? (
                  <p className="mt-2 font-mono text-xs font-semibold text-[#075E54]">
                    N° {cert.certificate_id}
                  </p>
                ) : null}
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-[#075E54]/5 p-3 text-xs text-gray-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#075E54]" />
                <p>
                  Ce certificat a été émis par la plateforme Wazo Digital après validation
                  complète du parcours (100 %). Il est reconnu par l&apos;organisme de formation
                  et vérifiable à tout moment via ce lien ou le QR code du document PDF.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-center text-sm text-red-600">
              {payload?.error || "Ce certificat n'existe pas ou n'a pas été validé."}
            </p>
          )}

          <p className="mt-6 text-center text-xs">
            <Link href="/formation" className="text-[#075E54] underline">
              Portail formation Wazo Digital
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

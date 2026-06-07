"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Award, CheckCircle2, Loader2, XCircle } from "lucide-react";

interface VerifyPayload {
  valid: boolean;
  certificate?: {
    student_name: string;
    course_title: string;
    progress_percent: number;
    completed_at: string | null;
    token: string;
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
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex justify-center">
          {valid ? (
            <CheckCircle2 className="h-14 w-14 text-green-600" />
          ) : (
            <XCircle className="h-14 w-14 text-red-500" />
          )}
        </div>

        <h1 className="text-center text-lg font-bold text-gray-900">
          {valid ? "Certificat authentique" : "Certificat non valide"}
        </h1>

        {valid && cert ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl bg-green-50 p-4">
              <p className="flex items-center gap-2 font-medium text-green-800">
                <Award className="h-4 w-4" />
                {cert.student_name}
              </p>
              <p className="mt-1 text-gray-700">Formation : {cert.course_title}</p>
              <p className="text-gray-600">Progression : {cert.progress_percent}%</p>
              {cert.completed_at ? (
                <p className="text-gray-600">
                  Complété le :{" "}
                  {new Date(cert.completed_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              ) : null}
              <p className="mt-2 font-mono text-[10px] text-gray-500">
                Réf. {cert.token.slice(0, 16)}…
              </p>
            </div>
            <p className="text-center text-xs text-gray-500">
              Ce certificat a été émis par Wazo Digital et peut être vérifié via le QR code.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-red-600">
            {payload?.error || "Ce certificat n'existe pas ou n'a pas été validé."}
          </p>
        )}

        <p className="mt-6 text-center text-xs">
          <Link href="/formation" className="text-[#075E54] underline">
            Portail formation
          </Link>
        </p>
      </div>
    </main>
  );
}

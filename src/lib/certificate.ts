import { PROD_APP_URL } from "@/lib/site-urls";
import { certificatePdfUrl } from "@/lib/certificate-server";
import type { LearnerProgressMeta } from "@/types";

export function resolveAppBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (process.env.NEXT_PUBLIC_APP_URL || PROD_APP_URL).replace(/\/$/, "");
}

export function certificateVerifyUrl(token: string): string {
  return `${resolveAppBaseUrl()}/formation/verify/${encodeURIComponent(token)}`;
}

export interface CertificateDownloadContext {
  enrollmentId: string;
  inviteCode?: string;
  progressMeta?: LearnerProgressMeta;
  orderedModuleIds?: string[];
  hasQuizByModuleId?: Record<string, boolean>;
}

function openNativePdfDownload(pdfPath: string): void {
  const url = pdfPath.startsWith("http") ? pdfPath : new URL(pdfPath, window.location.origin).toString();
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Navigation directe : le gestionnaire Android/iOS reçoit le PDF avec le bon nom de fichier.
    window.location.assign(url);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  iframe.title = "Téléchargement certificat";
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 120_000);
}

export async function issueCertificateToken(
  params: CertificateDownloadContext
): Promise<{ token: string; verifyUrl: string; pdfUrl: string }> {
  const res = await fetch("/api/education/certificates/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enrollment_id: params.enrollmentId,
      invite_code: params.inviteCode,
      progress_meta: params.progressMeta,
      ordered_module_ids: params.orderedModuleIds,
      has_quiz_by_module_id: params.hasQuizByModuleId,
    }),
  });
  const json = (await res.json()) as {
    success: boolean;
    error?: string;
    token?: string;
    verify_url?: string;
    pdf_url?: string;
  };
  if (!res.ok || !json.success || !json.token) {
    throw new Error(json.error || "Impossible d'émettre le certificat");
  }
  const pdfUrl = json.pdf_url || certificatePdfUrl(json.token);
  return {
    token: json.token,
    verifyUrl: json.verify_url || certificateVerifyUrl(json.token),
    pdfUrl,
  };
}

/** Émet le certificat puis ouvre le PDF via URL serveur (fiable sur mobile). */
export async function downloadCertificatePdfWithQr(
  _studentName: string,
  _courseTitle: string,
  _instructorName: string,
  context: CertificateDownloadContext
): Promise<void> {
  const { pdfUrl } = await issueCertificateToken(context);
  openNativePdfDownload(pdfUrl);
}

/** Compatibilité : retourne le blob PDF. */
export async function generateCertificatePdfWithQr(
  studentName: string,
  courseTitle: string,
  instructorName: string,
  context: CertificateDownloadContext
): Promise<Blob> {
  const { pdfUrl } = await issueCertificateToken(context);
  const res = await fetch(pdfUrl);
  if (!res.ok) {
    throw new Error("Impossible de générer le certificat.");
  }
  const blob = await res.blob();
  if (!blob.size) {
    throw new Error("Le certificat généré est vide.");
  }
  void studentName;
  void courseTitle;
  void instructorName;
  return blob;
}

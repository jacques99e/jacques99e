import QRCode from "qrcode";

import { PROD_APP_URL } from "@/lib/site-urls";

export function resolveAppBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (process.env.NEXT_PUBLIC_APP_URL || PROD_APP_URL).replace(/\/$/, "");
}

export function certificateVerifyUrl(token: string): string {
  return `${resolveAppBaseUrl()}/formation/verify/${encodeURIComponent(token)}`;
}

export async function generateCertificatePdfWithQr(
  studentName: string,
  courseTitle: string,
  instructorName: string,
  verifyToken: string
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape" });
  const verifyUrl = certificateVerifyUrl(verifyToken);
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 140, margin: 1 });

  doc.setDrawColor(7, 94, 84);
  doc.setLineWidth(0.8);
  doc.rect(10, 10, 277, 190);

  doc.setFontSize(26);
  doc.setTextColor(7, 94, 84);
  doc.text("Certificat de complétion", 148, 45, { align: "center" });

  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text(`Décerné à ${studentName}`, 148, 72, { align: "center" });
  doc.text(`Pour la formation : ${courseTitle}`, 148, 88, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Formateur : ${instructorName}`, 148, 108, { align: "center" });
  doc.text(`Date : ${new Date().toLocaleDateString("fr-FR")}`, 148, 120, { align: "center" });

  doc.addImage(qrDataUrl, "PNG", 228, 125, 38, 38);
  doc.setFontSize(8);
  doc.text("Vérification", 247, 168, { align: "center" });
  doc.text(`Réf. ${verifyToken.slice(0, 12)}`, 247, 174, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Wazo Digital — Formation certifiée", 148, 185, { align: "center" });

  return doc.output("blob");
}

export async function issueCertificateToken(params: {
  enrollmentId: string;
  inviteCode?: string;
}): Promise<{ token: string; verifyUrl: string }> {
  const res = await fetch("/api/education/certificates/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enrollment_id: params.enrollmentId,
      invite_code: params.inviteCode,
    }),
  });
  const json = (await res.json()) as {
    success: boolean;
    error?: string;
    token?: string;
    verify_url?: string;
  };
  if (!res.ok || !json.success || !json.token) {
    throw new Error(json.error || "Impossible d'émettre le certificat");
  }
  return { token: json.token, verifyUrl: json.verify_url || certificateVerifyUrl(json.token) };
}

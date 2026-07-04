import QRCode from "qrcode";
import { formatCertificateId } from "@/lib/education-enrollment";
import { PROD_APP_URL } from "@/lib/site-urls";

function resolveVerifyBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || PROD_APP_URL).replace(/\/$/, "");
}

export function certificateVerifyUrlServer(token: string): string {
  return `${resolveVerifyBaseUrl()}/formation/verify/${encodeURIComponent(token)}`;
}

export interface CertificateDocumentData {
  studentName: string;
  courseTitle: string;
  organizationName: string;
  instructorName: string;
  completedAt: string;
  verifyToken: string;
  moduleCount?: number;
}

function formatLongDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return new Date().toLocaleDateString("fr-FR");
  }
}

export async function buildCertificatePdfBuffer(
  data: CertificateDocumentData
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const verifyUrl = certificateVerifyUrlServer(data.verifyToken);
  const certId = formatCertificateId(data.verifyToken);
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1, errorCorrectionLevel: "M" });
  const completedLabel = formatLongDate(data.completedAt);

  const pageW = 297;
  const pageH = 210;
  const margin = 12;

  doc.setFillColor(255, 248, 240);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setDrawColor(7, 94, 84);
  doc.setLineWidth(1.2);
  doc.rect(margin, margin, pageW - margin * 2, pageH - margin * 2);

  doc.setDrawColor(255, 111, 0);
  doc.setLineWidth(0.4);
  doc.rect(margin + 4, margin + 4, pageW - margin * 2 - 8, pageH - margin * 2 - 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(7, 94, 84);
  doc.text("WAZO DIGITAL", pageW / 2, margin + 14, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Plateforme de formation professionnelle — Afrique", pageW / 2, margin + 20, {
    align: "center",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(7, 94, 84);
  doc.text("CERTIFICAT DE RÉUSSITE", pageW / 2, 58, { align: "center" });

  doc.setDrawColor(255, 111, 0);
  doc.setLineWidth(0.6);
  doc.line(70, 64, pageW - 70, 64);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text("Le présent document certifie que", pageW / 2, 78, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text(data.studentName, pageW / 2, 92, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text("a complété avec succès la formation", pageW / 2, 104, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(7, 94, 84);
  doc.text(`« ${data.courseTitle} »`, pageW / 2, 116, { align: "center" });

  if (data.moduleCount && data.moduleCount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`${data.moduleCount} module${data.moduleCount > 1 ? "s" : ""} validé${data.moduleCount > 1 ? "s" : ""}`, pageW / 2, 124, {
      align: "center",
    });
  }

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Délivré le ${completedLabel}`, pageW / 2, 136, { align: "center" });
  doc.text(`Organisme : ${data.organizationName}`, pageW / 2, 143, { align: "center" });
  doc.text(`Formateur : ${data.instructorName}`, pageW / 2, 150, { align: "center" });

  doc.addImage(qrDataUrl, "PNG", pageW - margin - 42, pageH - margin - 48, 36, 36);
  doc.setFontSize(8);
  doc.setTextColor(7, 94, 84);
  doc.text("Vérification", pageW - margin - 24, pageH - margin - 8, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(`N° ${certId}`, margin + 8, pageH - margin - 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  const verifyLine = verifyUrl.replace(/^https?:\/\//, "");
  doc.text(`Authentification : ${verifyLine}`, margin + 8, pageH - margin - 11);
  doc.text(
    "Document numérique vérifiable — scannez le QR code ou consultez l'URL ci-dessus.",
    margin + 8,
    pageH - margin - 6
  );

  doc.setFontSize(8);
  doc.setTextColor(7, 94, 84);
  doc.text(
    "Certificat reconnu par la plateforme Wazo Digital · Référence unique et infalsifiable",
    pageW / 2,
    pageH - margin - 2,
    { align: "center" }
  );

  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}

/** @deprecated — préférer buildCertificatePdfBuffer avec CertificateDocumentData */
export async function buildCertificatePdfBufferLegacy(
  studentName: string,
  courseTitle: string,
  instructorName: string,
  verifyToken: string
): Promise<Buffer> {
  return buildCertificatePdfBuffer({
    studentName,
    courseTitle,
    organizationName: "Wazo Digital",
    instructorName,
    completedAt: new Date().toISOString(),
    verifyToken,
  });
}

export function certificateFilename(studentName: string): string {
  const safe = studentName.replace(/\s+/g, "-").replace(/[^\w.-]/g, "");
  return `certificat-wazo-${safe || "apprenant"}.pdf`;
}

export function certificateContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_") || "certificat.pdf";
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function certificatePdfUrl(token: string): string {
  return `/api/education/certificates/pdf/${encodeURIComponent(token)}`;
}

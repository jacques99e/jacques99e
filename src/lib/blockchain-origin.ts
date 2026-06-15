import { traceUrl } from "@/lib/blockchain-public";
import type { BlockchainAsset } from "@/types";

export async function downloadOriginCertificatePdf(
  asset: BlockchainAsset,
  storeName: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait" });
  const trace = traceUrl(asset.hash_sha256);
  const date = new Date().toLocaleDateString("fr-FR");

  doc.setFontSize(18);
  doc.text("Certificat d'origine Wazo", 105, 24, { align: "center" });
  doc.setFontSize(11);
  doc.text(`Émis par : ${storeName}`, 20, 40);
  doc.text(`Date : ${date}`, 20, 48);
  doc.setFontSize(13);
  doc.text(asset.name, 20, 64);
  doc.setFontSize(10);
  doc.text(`Type : ${asset.asset_type}`, 20, 74);
  if (asset.latitude != null && asset.longitude != null) {
    doc.text(`Origine GPS : ${asset.latitude}, ${asset.longitude}`, 20, 82);
  }
  doc.text("Empreinte SHA-256 :", 20, 96);
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  const hashLines = doc.splitTextToSize(asset.hash_sha256, 170);
  doc.text(hashLines, 20, 104);
  if (asset.celo_tx_hash) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Ancré Celo : ${asset.celo_tx_hash.slice(0, 42)}…`, 20, 130);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Vérification publique :", 20, 148);
  doc.text(trace, 20, 156);
  doc.text(
    "Scannez le QR sur l'étiquette ou ouvrez le lien pour prouver l'origine.",
    20,
    172,
    { maxWidth: 170 }
  );

  doc.save(`origine-${asset.name.replace(/\s+/g, "-").slice(0, 40)}.pdf`);
}

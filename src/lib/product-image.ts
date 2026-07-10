/** Normalise une photo produit pour upload + vision IA (JPEG, taille raisonnable). */

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire cette image."));
    };
    img.src = url;
  });
}

/**
 * Convertit n’importe quelle image (HEIC parfois refusé) en JPEG via canvas.
 * Si le canvas échoue (HEIC non décodé), renvoie le fichier d’origine.
 */
export async function normalizeProductImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && file.type !== "" && file.type !== "application/octet-stream") {
    throw new Error("Le fichier doit être une image.");
  }

  // Déjà un JPEG raisonnable : pas besoin de retraiter
  if (
    (file.type === "image/jpeg" || file.type === "image/jpg") &&
    file.size <= 1.5 * 1024 * 1024
  ) {
    return file;
  }

  try {
    const img = await loadImageFromFile(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "produit";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function revokePreviewUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

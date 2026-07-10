import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { analyzeProductImage } from "@/lib/assistant-product-vision";

export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Formulaire invalide" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { success: false, error: "Photo requise" },
      { status: 400 }
    );
  }

  const mediaType =
    (file.type && file.type.startsWith("image/")
      ? file.type
      : "image/jpeg") || "image/jpeg";

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        success: false,
        error: "Image trop lourde (max 5 Mo). Prenez une photo plus légère.",
      },
      { status: 400 }
    );
  }

  if (file.size < 100) {
    return NextResponse.json(
      { success: false, error: "Fichier image vide ou invalide." },
      { status: 400 }
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const result = await analyzeProductImage({
    imageBytes: buffer,
    mediaType,
  });

  if (result.source === "fallback") {
    return NextResponse.json({
      success: true,
      source: result.source,
      suggestion: result.suggestion,
      warning:
        result.error ||
        "IA indisponible — complétez la fiche manuellement.",
    });
  }

  return NextResponse.json({
    success: true,
    source: result.source,
    suggestion: result.suggestion,
  });
}

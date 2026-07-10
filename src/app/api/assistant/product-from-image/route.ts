import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { analyzeProductImage } from "@/lib/assistant-product-vision";

const MAX_BYTES = 4 * 1024 * 1024;

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
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Photo requise" },
      { status: 400 }
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { success: false, error: "Le fichier doit être une image" },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: "Image trop lourde (max 4 Mo). Prenez une photo plus légère." },
      { status: 400 }
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const result = await analyzeProductImage({
    imageBytes: buffer,
    mediaType: file.type || "image/jpeg",
  });

  if (result.source === "fallback" && result.error) {
    return NextResponse.json({
      success: true,
      source: result.source,
      suggestion: result.suggestion,
      warning: result.error,
    });
  }

  return NextResponse.json({
    success: true,
    source: result.source,
    suggestion: result.suggestion,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Fichier image requis." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Format image invalide." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "Image trop volumineuse (max 5 Mo)." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${auth.userId}/${Date.now()}.${ext}`;
    const service = await createServiceSupabase();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await service.storage.from("product-images").upload(path, buffer, {
      upsert: true,
      contentType: file.type,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || "Upload impossible." },
        { status: 500 }
      );
    }

    const { data } = service.storage.from("product-images").getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible d'envoyer l'image." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";

const ALLOWED_BUCKETS = new Set(["product-images", "course-media", "certificates"]);

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const bucket = String(formData.get("bucket") || "product-images");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Fichier requis." }, { status: 400 });
    }
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ success: false, error: "Bucket non autorise." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${auth.userId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const service = await createServiceSupabase();
    const { error } = await service.storage.from(bucket).upload(path, buffer, {
      contentType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: true,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || "Upload impossible." },
        { status: 500 }
      );
    }

    const { data } = service.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible d'envoyer le fichier." },
      { status: 500 }
    );
  }
}

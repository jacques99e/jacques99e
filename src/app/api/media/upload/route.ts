import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";

const BUCKET_CONFIG: Record<string, { public: boolean }> = {
  "product-images": { public: true },
  "course-media": { public: true },
  certificates: { public: true },
  "health-docs": { public: false },
};

const ALLOWED_BUCKETS = new Set(Object.keys(BUCKET_CONFIG));

async function ensureBucket(service: SupabaseClient, bucket: string): Promise<string | null> {
  const { data: buckets, error: listError } = await service.storage.listBuckets();
  if (listError) return listError.message;

  if (buckets?.some((b) => b.id === bucket)) return null;

  const config = BUCKET_CONFIG[bucket];
  const { error } = await service.storage.createBucket(bucket, {
    public: config.public,
    fileSizeLimit: 10 * 1024 * 1024,
  });

  if (error?.message?.toLowerCase().includes("already exists")) return null;
  return error?.message ?? null;
}

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
    const bucketError = await ensureBucket(service, bucket);
    if (bucketError) {
      return NextResponse.json(
        { success: false, error: bucketError || "Impossible de preparer le stockage." },
        { status: 500 }
      );
    }

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

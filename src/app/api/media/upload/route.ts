import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";

const MB = 1024 * 1024;

const BUCKET_CONFIG: Record<string, { public: boolean; fileSizeLimit: number }> = {
  "product-images": { public: true, fileSizeLimit: 10 * MB },
  "course-media": { public: true, fileSizeLimit: 50 * MB },
  certificates: { public: true, fileSizeLimit: 10 * MB },
  "health-docs": { public: false, fileSizeLimit: 10 * MB },
};

const ALLOWED_BUCKETS = new Set(Object.keys(BUCKET_CONFIG));

/** MIME autorisés par bucket (validation côté API, en plus des limites Storage). */
const ALLOWED_MIME_BY_BUCKET: Record<string, Set<string>> = {
  "product-images": new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  "course-media": new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "application/pdf",
  ]),
  certificates: new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  "health-docs": new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]),
};

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
};

function sniffMime(buffer: Buffer, declared: string, ext: string): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 6) === "GIF87a") return "image/gif";
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 6) === "GIF89a") return "image/gif";
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") return "application/pdf";
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return declared.startsWith("video/") ? declared : "video/mp4";
  }
  // Fallback contrôlé : uniquement si déclaration + extension cohérentes et autorisées
  const fromExt = EXT_MIME[ext];
  if (declared && fromExt && declared === fromExt) return declared;
  return fromExt || null;
}

async function ensureBucket(service: SupabaseClient, bucket: string): Promise<string | null> {
  const { data: buckets, error: listError } = await service.storage.listBuckets();
  if (listError) return listError.message;

  if (buckets?.some((b) => b.id === bucket)) return null;

  const config = BUCKET_CONFIG[bucket];
  const { error } = await service.storage.createBucket(bucket, {
    public: config.public,
    fileSizeLimit: config.fileSizeLimit,
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

    const sizeLimit = BUCKET_CONFIG[bucket].fileSizeLimit;
    if (file.size <= 0 || file.size > sizeLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `Fichier trop volumineux (max ${Math.round(sizeLimit / MB)} Mo).`,
        },
        { status: 400 }
      );
    }

    const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
    const ext = EXT_MIME[rawExt] ? rawExt : "bin";
    if (ext === "bin") {
      return NextResponse.json(
        { success: false, error: "Extension de fichier non autorisee." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = sniffMime(buffer, file.type || "", ext);
    const allowed = ALLOWED_MIME_BY_BUCKET[bucket];
    if (!mime || !allowed?.has(mime)) {
      return NextResponse.json(
        { success: false, error: "Type de fichier non autorise pour ce bucket." },
        { status: 400 }
      );
    }

    const safeExt = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || ext;
    const path = `${auth.userId}/${Date.now()}.${safeExt}`;

    const service = await createServiceSupabase();
    const bucketError = await ensureBucket(service, bucket);
    if (bucketError) {
      return NextResponse.json(
        { success: false, error: bucketError || "Impossible de preparer le stockage." },
        { status: 500 }
      );
    }

    const { error } = await service.storage.from(bucket).upload(path, buffer, {
      contentType: mime,
      upsert: false,
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

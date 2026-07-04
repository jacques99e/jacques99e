import { supabase } from "@/lib/supabase/client";

export type LessonMediaKind = "youtube" | "facebook" | "file" | "external";

export interface ParsedLessonMedia {
  kind: LessonMediaKind;
  /** URL pour lecture directe (fichier) ou page externe */
  watchUrl: string;
  /** ID YouTube pour iframe */
  youtubeId?: string;
}

const COURSE_VIDEO_MAX_MB = 50;

export function parseLessonMediaUrl(raw: string): ParsedLessonMedia | null {
  const url = raw.trim();
  if (!url) return null;

  const ytMatch =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/i) ||
    url.match(/youtube\.com\/shorts\/([\w-]{11})/i);
  if (ytMatch?.[1]) {
    return {
      kind: "youtube",
      watchUrl: url,
      youtubeId: ytMatch[1],
    };
  }

  if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) {
    return { kind: "facebook", watchUrl: url };
  }

  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || url.includes("/storage/v1/object/public/course-media")) {
    return { kind: "file", watchUrl: url };
  }

  return { kind: "external", watchUrl: url };
}

function mapStorageUploadError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("payload too large") ||
    lower.includes("file size") ||
    lower.includes("exceeded the maximum")
  ) {
    return `Vidéo trop lourde (max ${COURSE_VIDEO_MAX_MB} Mo). Utilisez un lien YouTube pour économiser la data.`;
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("policy") ||
    lower.includes("not authorized")
  ) {
    return "Session expirée ou accès refusé. Veuillez vous reconnecter.";
  }
  if (lower.includes("jwt") || lower.includes("expired")) {
    return "Session expirée. Veuillez vous reconnecter.";
  }
  return message || "Impossible d'envoyer la vidéo.";
}

/** Upload direct vers Supabase Storage (évite la limite ~4,5 Mo des routes API Vercel). */
export async function uploadCourseVideo(
  userId: string,
  courseId: string,
  file: File
): Promise<string> {
  if (file.size > COURSE_VIDEO_MAX_MB * 1024 * 1024) {
    throw new Error(
      `Vidéo trop lourde (max ${COURSE_VIDEO_MAX_MB} Mo). Utilisez un lien YouTube pour économiser la data.`
    );
  }

  if (!navigator.onLine) {
    throw new Error("Connexion requise pour envoyer la vidéo.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `${userId}/${courseId}/${Date.now()}.${ext}`;
  const contentType =
    file.type ||
    (ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : `video/${ext}`);

  const { error } = await supabase.storage.from("course-media").upload(path, file, {
    contentType,
    upsert: false,
    cacheControl: "3600",
  });

  if (error) {
    throw new Error(mapStorageUploadError(error.message));
  }

  const { data } = supabase.storage.from("course-media").getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error("Impossible d'envoyer la vidéo.");
  }

  return data.publicUrl;
}

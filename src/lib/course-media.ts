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

const YOUTUBE_HOSTS = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
const FACEBOOK_HOSTS = ["facebook.com", "fb.com", "fb.watch"];

function hostMatches(hostname: string, roots: string[]): boolean {
  const host = hostname.toLowerCase();
  return roots.some((root) => host === root || host.endsWith(`.${root}`));
}

function lessonUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.protocol = "https:";
  return url;
}

export function parseLessonMediaUrl(raw: string): ParsedLessonMedia | null {
  const url = lessonUrl(raw);
  if (!url) return null;

  if (hostMatches(url.hostname, YOUTUBE_HOSTS)) {
    const fromPath = url.hostname.toLowerCase() === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : "";
    const fromQuery = url.searchParams.get("v") || "";
    const fromEmbed = url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)?.[1] || "";
    const youtubeId = [fromPath, fromQuery, fromEmbed].find((id) => /^[\w-]{11}$/.test(id));
    if (!youtubeId) return null;
    return {
      kind: "youtube",
      watchUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      youtubeId,
    };
  }

  if (hostMatches(url.hostname, FACEBOOK_HOSTS)) {
    return { kind: "facebook", watchUrl: url.toString() };
  }

  const path = url.pathname;
  if (
    hostMatches(url.hostname, ["supabase.co"]) &&
    path.includes("/storage/v1/object/public/course-media/") &&
    /\.(mp4|webm|ogg|mov)$/i.test(path)
  ) {
    return { kind: "file", watchUrl: url.toString() };
  }

  return null;
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

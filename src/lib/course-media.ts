export type LessonMediaKind = "youtube" | "facebook" | "file" | "external";

export interface ParsedLessonMedia {
  kind: LessonMediaKind;
  /** URL pour lecture directe (fichier) ou page externe */
  watchUrl: string;
  /** ID YouTube pour iframe */
  youtubeId?: string;
}

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

export async function uploadCourseVideo(
  userId: string,
  courseId: string,
  file: File
): Promise<string> {
  const maxMb = 80;
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Vidéo trop lourde (max ${maxMb} Mo). Utilisez un lien YouTube pour économiser la data.`);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const safeExt = ["mp4", "webm", "mov", "ogg"].includes(ext) ? ext : "mp4";
  const path = `${userId}/${courseId}/${Date.now()}.${safeExt}`;

  const { supabase } = await import("@/lib/supabase/client");

  if (!navigator.onLine) {
    return URL.createObjectURL(file);
  }

  const { error } = await supabase.storage.from("course-media").upload(path, file, {
    upsert: true,
    contentType: file.type || `video/${safeExt}`,
  });

  if (error) {
    throw new Error(error.message || "Impossible d'envoyer la vidéo.");
  }

  const { data } = supabase.storage.from("course-media").getPublicUrl(path);
  return data.publicUrl;
}

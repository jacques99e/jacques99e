import { apiFetch } from "@/lib/api-client";

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
  _userId: string,
  _courseId: string,
  file: File
): Promise<string> {
  const maxMb = 80;
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Vidéo trop lourde (max ${maxMb} Mo). Utilisez un lien YouTube pour économiser la data.`);
  }

  if (!navigator.onLine) {
    throw new Error("Connexion requise pour envoyer la vidéo.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", "course-media");

  const response = await apiFetch("/api/media/upload", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as {
    success: boolean;
    url?: string;
    error?: string;
  };

  if (!response.ok || !payload.success || !payload.url) {
    throw new Error(payload.error || "Impossible d'envoyer la vidéo.");
  }

  return payload.url;
}

"use client";

import { ExternalLink, Play } from "lucide-react";
import { parseLessonMediaUrl } from "@/lib/course-media";

export function LessonVideoPlayer({ url, title }: { url: string; title?: string }) {
  const parsed = parseLessonMediaUrl(url);
  if (!parsed) return null;

  if (parsed.kind === "youtube" && parsed.youtubeId) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          title={title || "Leçon vidéo"}
          src={`https://www.youtube-nocookie.com/embed/${parsed.youtubeId}?rel=0`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (parsed.kind === "file") {
    return (
      <video
        controls
        playsInline
        preload="metadata"
        className="w-full rounded-xl bg-black"
        src={parsed.watchUrl}
      >
        Votre navigateur ne lit pas cette vidéo.
      </video>
    );
  }

  return (
    <a
      href={parsed.watchUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <Play className="h-5 w-5 shrink-0" />
      <span className="flex-1">
        {parsed.kind === "facebook" ? "Voir la vidéo sur Facebook" : "Ouvrir la leçon vidéo"}
      </span>
      <ExternalLink className="h-4 w-4 shrink-0" />
    </a>
  );
}

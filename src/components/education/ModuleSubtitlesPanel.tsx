"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getModuleSubtitles,
  saveModuleSubtitles,
  SUBTITLE_LANGUAGES,
} from "@/lib/education-extras";
import type { CourseSubtitleLang, ModuleSubtitles } from "@/types";

interface ModuleSubtitlesPanelProps {
  moduleId: string;
  mode: "edit" | "view";
  defaultLang?: CourseSubtitleLang;
}

export function ModuleSubtitlesPanel({
  moduleId,
  mode,
  defaultLang = "fr",
}: ModuleSubtitlesPanelProps) {
  const [subtitles, setSubtitles] = useState<ModuleSubtitles>({});
  const [lang, setLang] = useState<CourseSubtitleLang>(defaultLang);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getModuleSubtitles(moduleId).then((s) => {
      setSubtitles(s);
      setLoaded(true);
    });
  }, [moduleId]);

  const current = subtitles[lang]?.trim() ?? "";
  const availableLangs = SUBTITLE_LANGUAGES.filter((l) => subtitles[l.code]?.trim());

  if (!loaded) return null;

  if (mode === "view") {
    if (!availableLangs.length && !current) return null;
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {SUBTITLE_LANGUAGES.map((l) => {
            const has = Boolean(subtitles[l.code]?.trim());
            if (!has) return null;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  lang === l.code ? "bg-[#075E54] text-white" : "bg-white text-gray-600"
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
          {subtitles[lang] || "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-dashed border-[#075E54]/30 p-3">
      <Label className="flex items-center gap-2 text-xs text-[#075E54]">
        <Languages className="h-3.5 w-3.5" />
        Sous-titres / transcription (FR, EN, Wolof, Swahili)
      </Label>
      <div className="flex flex-wrap gap-1">
        {SUBTITLE_LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              lang === l.code ? "bg-[#075E54] text-white" : "bg-gray-100"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <textarea
        value={subtitles[lang] ?? ""}
        onChange={(e) =>
          setSubtitles((prev) => ({ ...prev, [lang]: e.target.value }))
        }
        rows={3}
        placeholder={`Texte ou transcription en ${SUBTITLE_LANGUAGES.find((x) => x.code === lang)?.label}…`}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await saveModuleSubtitles(moduleId, subtitles);
          setSaving(false);
        }}
      >
        {saving ? "Enregistrement…" : "Enregistrer les sous-titres"}
      </Button>
    </div>
  );
}

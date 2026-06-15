"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Film, Pencil, Trash2, Upload, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { ModuleQuizPanel } from "@/components/education/ModuleQuizPanel";
import { ModuleSubtitlesPanel } from "@/components/education/ModuleSubtitlesPanel";
import { uploadCourseVideo } from "@/lib/course-media";
import {
  deleteCourseModule,
  reorderCourseModules,
  updateCourseModule,
} from "@/lib/education";
import { getModuleQuiz, moduleHasQuiz } from "@/lib/education-extras";
import type { CourseModule } from "@/types";

interface LessonEditorCardProps {
  module: CourseModule;
  courseId: string;
  userId?: string;
  index: number;
  total: number;
  orderedIds: string[];
  onChanged: () => void;
}

export function LessonEditorCard({
  module: m,
  courseId,
  userId,
  index,
  total,
  orderedIds,
  onChanged,
}: LessonEditorCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [content, setContent] = useState(m.content ?? "");
  const [videoLink, setVideoLink] = useState(m.media_url ?? "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);

  useEffect(() => {
    void getModuleQuiz(m.id, courseId).then((q) => setHasQuiz(moduleHasQuiz(q)));
  }, [m.id, courseId]);

  const move = async (direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedIds.length) return;
    const next = [...orderedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    await reorderCourseModules(courseId, next);
    onChanged();
  };

  const save = async () => {
    setSaving(true);
    try {
      let mediaUrl = videoLink.trim() || null;
      if (videoFile && userId) {
        mediaUrl = await uploadCourseVideo(userId, courseId, videoFile);
      }
      await updateCourseModule(m.id, courseId, {
        title: title.trim(),
        content: content.trim() || null,
        media_url: mediaUrl,
      });
      setEditing(false);
      setVideoFile(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Supprimer la leçon « ${m.title} » ?`)) return;
    await deleteCourseModule(m.id, courseId);
    onChanged();
  };

  return (
    <li className="space-y-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {m.media_url ? <Film className="mt-0.5 h-4 w-4 shrink-0 text-[#075E54]" /> : null}
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Leçon {index + 1}</p>
            {!editing ? (
              <>
                <p className="font-medium">{m.title}</p>
                {m.content ? <p className="text-xs text-gray-500">{m.content}</p> : null}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0} onClick={() => void move(-1)}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index >= total - 1} onClick={() => void move(1)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => void remove()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
          <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Résumé texte" />
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-xs">
              <Link2 className="h-3 w-3" />
              Lien YouTube / Facebook
            </Label>
            <Input
              value={videoLink}
              onChange={(e) => {
                setVideoLink(e.target.value);
                if (e.target.value.trim()) setVideoFile(null);
              }}
              placeholder="https://youtube.com/..."
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-xs">
              <Upload className="h-3 w-3" />
              Fichier MP4 (max 80 Mo)
            </Label>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="block w-full text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setVideoFile(file);
                if (file) setVideoLink("");
              }}
            />
          </div>
          <Button type="button" size="sm" disabled={saving || !title.trim()} onClick={() => void save()}>
            {saving ? "…" : "Enregistrer la leçon"}
          </Button>
        </div>
      ) : null}

      {!editing && m.media_url ? <LessonVideoPlayer url={m.media_url} title={m.title} /> : null}
      <ModuleSubtitlesPanel moduleId={m.id} mode="edit" />
      <ModuleQuizPanel
        moduleId={m.id}
        courseId={courseId}
        moduleTitle={m.title}
        mode="edit"
      />
      {!editing ? (
        <p className="text-[10px] text-gray-400">
          {m.media_url ? "Vidéo · " : ""}
          {hasQuiz ? "Quiz configuré" : "Ajoutez un quiz ci-dessous pour valider la leçon"}
        </p>
      ) : null}
    </li>
  );
}

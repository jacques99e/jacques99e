import { supabase } from "@/lib/supabase/client";
import { generateLocalId } from "@/lib/sync";
import type {
  CourseSubtitleLang,
  LearnerProgressMeta,
  ModuleQuiz,
  ModuleSubtitles,
  QuizQuestion,
} from "@/types";

export const SUBTITLE_LANGUAGES: { code: CourseSubtitleLang; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "wo", label: "Wolof" },
  { code: "sw", label: "Swahili" },
];

function quizKey(moduleId: string) {
  return `wazo_module_quiz_${moduleId}`;
}

function subtitlesKey(moduleId: string) {
  return `wazo_module_subtitles_${moduleId}`;
}

function progressKey(courseId: string, enrollmentId: string) {
  return `wazo_learner_progress_${courseId}_${enrollmentId}`;
}

export function emptyProgressMeta(): LearnerProgressMeta {
  return { completedModuleIds: [], passedQuizModuleIds: [] };
}

export function moduleHasQuiz(quiz: ModuleQuiz | null | undefined): boolean {
  return Boolean(quiz?.questions?.length);
}

export function isLessonComplete(moduleId: string, meta: LearnerProgressMeta): boolean {
  return meta.completedModuleIds.includes(moduleId);
}

export function isQuizPassed(moduleId: string, meta: LearnerProgressMeta): boolean {
  return meta.passedQuizModuleIds.includes(moduleId);
}

/** Leçon vue + quiz réussi si un quiz existe pour cette leçon */
export function isModuleFullyComplete(
  moduleId: string,
  meta: LearnerProgressMeta,
  hasQuiz: boolean
): boolean {
  if (!isLessonComplete(moduleId, meta)) return false;
  if (hasQuiz && !isQuizPassed(moduleId, meta)) return false;
  return true;
}

export function isModuleUnlocked(
  moduleIndex: number,
  orderedModuleIds: string[],
  meta: LearnerProgressMeta,
  hasQuizByModuleId: Record<string, boolean>
): boolean {
  if (moduleIndex <= 0) return true;
  const previousId = orderedModuleIds[moduleIndex - 1];
  if (!previousId) return true;
  return isModuleFullyComplete(previousId, meta, hasQuizByModuleId[previousId] ?? false);
}

export function computeProgressPercent(
  orderedModuleIds: string[],
  meta: LearnerProgressMeta,
  hasQuizByModuleId: Record<string, boolean>
): number {
  if (!orderedModuleIds.length) return 0;
  let complete = 0;
  for (const id of orderedModuleIds) {
    if (isModuleFullyComplete(id, meta, hasQuizByModuleId[id] ?? false)) complete += 1;
  }
  return Math.min(100, Math.round((complete / orderedModuleIds.length) * 100));
}

export function readLocalQuiz(moduleId: string): ModuleQuiz | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(quizKey(moduleId));
    return raw ? (JSON.parse(raw) as ModuleQuiz) : null;
  } catch {
    return null;
  }
}

export function writeLocalQuiz(quiz: ModuleQuiz) {
  if (typeof window === "undefined") return;
  localStorage.setItem(quizKey(quiz.module_id), JSON.stringify(quiz));
}

export async function getModuleQuiz(
  moduleId: string,
  courseId: string
): Promise<ModuleQuiz | null> {
  const local = readLocalQuiz(moduleId);
  if (!navigator.onLine) return local;

  const { data, error } = await supabase
    .from("course_quizzes")
    .select("*")
    .eq("module_id", moduleId)
    .maybeSingle();

  if (error) return local;

  if (data) {
    const quiz: ModuleQuiz = {
      module_id: moduleId,
      course_id: courseId,
      title: data.title as string,
      passing_score: (data.passing_score as number) ?? 70,
      questions: (data.questions as QuizQuestion[]) ?? [],
    };
    writeLocalQuiz(quiz);
    return quiz;
  }

  return local;
}

export async function saveModuleQuiz(quiz: ModuleQuiz): Promise<void> {
  writeLocalQuiz(quiz);

  if (!navigator.onLine) return;

  const payload = {
    course_id: quiz.course_id,
    module_id: quiz.module_id,
    title: quiz.title,
    questions: quiz.questions,
    passing_score: quiz.passing_score,
  };

  const { data: existing } = await supabase
    .from("course_quizzes")
    .select("id")
    .eq("module_id", quiz.module_id)
    .maybeSingle();

  try {
    if (existing?.id) {
      await supabase.from("course_quizzes").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("course_quizzes").insert(payload);
    }
  } catch {
    /* module_id peut manquer avant migration 010 */
  }
}

export function readLocalSubtitles(moduleId: string): ModuleSubtitles {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(subtitlesKey(moduleId));
    return raw ? (JSON.parse(raw) as ModuleSubtitles) : {};
  } catch {
    return {};
  }
}

export function writeLocalSubtitles(moduleId: string, subtitles: ModuleSubtitles) {
  if (typeof window === "undefined") return;
  localStorage.setItem(subtitlesKey(moduleId), JSON.stringify(subtitles));
}

export async function getModuleSubtitles(moduleId: string): Promise<ModuleSubtitles> {
  const local = readLocalSubtitles(moduleId);
  if (!navigator.onLine) return local;

  const { data } = await supabase
    .from("course_modules")
    .select("subtitles")
    .eq("id", moduleId)
    .maybeSingle();

  const fromDb = (data?.subtitles as ModuleSubtitles) ?? {};
  const merged = { ...local, ...fromDb };
  writeLocalSubtitles(moduleId, merged);
  return merged;
}

export async function saveModuleSubtitles(
  moduleId: string,
  subtitles: ModuleSubtitles
): Promise<void> {
  writeLocalSubtitles(moduleId, subtitles);
  if (!navigator.onLine) return;
  const { error } = await supabase
    .from("course_modules")
    .update({ subtitles })
    .eq("id", moduleId);
  if (error) {
    /* colonne subtitles absente si migration 010 non appliquée — localStorage suffit */
  }
}

export function readLocalProgress(
  courseId: string,
  enrollmentId: string
): LearnerProgressMeta {
  if (typeof window === "undefined") return emptyProgressMeta();
  try {
    const raw = localStorage.getItem(progressKey(courseId, enrollmentId));
    if (!raw) return emptyProgressMeta();
    const parsed = JSON.parse(raw) as LearnerProgressMeta;
    return {
      completedModuleIds: parsed.completedModuleIds ?? [],
      passedQuizModuleIds: parsed.passedQuizModuleIds ?? [],
    };
  } catch {
    return emptyProgressMeta();
  }
}

export function writeLocalProgress(
  courseId: string,
  enrollmentId: string,
  meta: LearnerProgressMeta
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(progressKey(courseId, enrollmentId), JSON.stringify(meta));
}

async function savePublicProgress(
  inviteCode: string,
  enrollmentId: string,
  meta: LearnerProgressMeta,
  percent: number
): Promise<void> {
  const res = await fetch(`/api/education/public/${encodeURIComponent(inviteCode)}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enrollment_id: enrollmentId,
      progress_meta: meta,
      progress_percent: percent,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Synchronisation de la progression impossible");
  }
}

export async function saveLearnerProgress(
  courseId: string,
  enrollmentId: string,
  meta: LearnerProgressMeta,
  orderedModuleIds: string[],
  hasQuizByModuleId: Record<string, boolean>,
  publicInviteCode?: string
): Promise<number> {
  writeLocalProgress(courseId, enrollmentId, meta);
  const percent = computeProgressPercent(orderedModuleIds, meta, hasQuizByModuleId);
  const completed = percent >= 100;

  if (!navigator.onLine) return percent;

  if (publicInviteCode) {
    try {
      await savePublicProgress(publicInviteCode, enrollmentId, meta, percent);
    } catch {
      /* garde la progression locale */
    }
    return percent;
  }

  const { error } = await supabase
    .from("course_enrollments")
    .update({
      progress_percent: percent,
      progress_meta: meta,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", enrollmentId);

  if (error) {
    await supabase
      .from("course_enrollments")
      .update({
        progress_percent: percent,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", enrollmentId);
  }

  return percent;
}

export function createEmptyQuestion(): QuizQuestion {
  return {
    id: generateLocalId(),
    prompt: "",
    choices: ["", "", ""],
    correctIndex: 0,
  };
}

export function gradeQuiz(
  quiz: ModuleQuiz,
  answers: Record<string, number>
): { score: number; passed: boolean } {
  if (!quiz.questions.length) return { score: 0, passed: false };
  let correct = 0;
  for (const q of quiz.questions) {
    if (answers[q.id] === q.correctIndex) correct += 1;
  }
  const score = Math.round((correct / quiz.questions.length) * 100);
  return { score, passed: score >= quiz.passing_score };
}

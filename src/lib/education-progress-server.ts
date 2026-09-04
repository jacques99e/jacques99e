import type { SupabaseClient } from "@supabase/supabase-js";
import { computeProgressPercent, moduleHasQuiz } from "@/lib/education-extras";
import type { LearnerProgressMeta } from "@/types";

export interface CompletionClientContext {
  orderedModuleIds?: string[];
  hasQuizByModuleId?: Record<string, boolean>;
}

function normalizeMeta(raw: unknown): LearnerProgressMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const meta = raw as LearnerProgressMeta;
  if (!Array.isArray(meta.completedModuleIds) || !Array.isArray(meta.passedQuizModuleIds)) {
    return null;
  }
  return {
    completedModuleIds: meta.completedModuleIds,
    passedQuizModuleIds: meta.passedQuizModuleIds,
  };
}

function buildHasQuizMap(
  orderedIds: string[],
  quizRows: Array<{ module_id: string; questions: unknown }> | null | undefined,
  clientHasQuiz?: Record<string, boolean>
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const id of orderedIds) {
    map[id] = clientHasQuiz?.[id] ?? false;
  }
  for (const row of quizRows ?? []) {
    const moduleId = row.module_id as string;
    if (!orderedIds.includes(moduleId)) continue;
    map[moduleId] =
      map[moduleId] ||
      moduleHasQuiz({
        module_id: moduleId,
        course_id: "",
        title: "",
        passing_score: 70,
        questions: (row.questions as never[]) ?? [],
      });
  }
  return map;
}

/** Recalcule la progression depuis progress_meta, avec repli sur les IDs client. */
export async function ensureEnrollmentCompleted(
  service: SupabaseClient,
  enrollment: {
    id: string;
    course_id: string;
    progress_percent?: number | null;
    progress_meta?: unknown;
    completed_at?: string | null;
  },
  clientMeta?: LearnerProgressMeta | null,
  clientContext?: CompletionClientContext
): Promise<{ ok: boolean; percent: number }> {
  const storedPercent = enrollment.progress_percent ?? 0;
  const meta = clientMeta ?? normalizeMeta(enrollment.progress_meta);
  if (!meta) {
    return { ok: false, percent: storedPercent };
  }

  let orderedIds = clientContext?.orderedModuleIds?.filter(Boolean) ?? [];

  if (!orderedIds.length) {
    const { data: modules, error: modulesError } = await service
      .from("course_modules")
      .select("id, sort_order")
      .eq("course_id", enrollment.course_id)
      .order("sort_order");

    if (modulesError || !modules?.length) {
      return { ok: false, percent: storedPercent };
    }
    orderedIds = modules.map((m) => m.id as string);
  }

  const { data: quizRows } = await service
    .from("course_quizzes")
    .select("module_id, questions")
    .in("module_id", orderedIds);

  const hasQuizByModuleId = buildHasQuizMap(
    orderedIds,
    quizRows as Array<{ module_id: string; questions: unknown }> | null,
    clientContext?.hasQuizByModuleId
  );

  const percent = computeProgressPercent(orderedIds, meta, hasQuizByModuleId);
  if (percent < 100) {
    return { ok: false, percent };
  }

  const completedAt = enrollment.completed_at || new Date().toISOString();
  const { error: updateError } = await service
    .from("course_enrollments")
    .update({
      progress_percent: 100,
      progress_meta: meta,
      completed_at: completedAt,
    })
    .eq("id", enrollment.id);

  if (updateError) {
    const { error: fallbackError } = await service
      .from("course_enrollments")
      .update({
        progress_percent: 100,
        completed_at: completedAt,
      })
      .eq("id", enrollment.id);
    if (fallbackError) {
      return { ok: false, percent };
    }
  }

  return { ok: true, percent: 100 };
}

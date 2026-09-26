import { NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { computeProgressPercent, moduleHasQuiz } from "@/lib/education-extras";
import { gradeStoredQuiz } from "@/lib/education-progress-server";
import { allowRequest } from "@/lib/rate-limit";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { LearnerProgressMeta, QuizQuestion } from "@/types";

/** Progression d'un cours privé : leçons cochées par l'apprenant, quiz noté ici. */
export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  if (!(await allowRequest(`education-progress:${auth.userId}`, 60, 60 * 60 * 1000))) {
    return NextResponse.json(
      { success: false, error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    enrollment_id?: string;
    progress_meta?: LearnerProgressMeta;
    quiz_attempt?: { module_id?: string; answers?: Record<string, number> };
  };
  const enrollmentId = body.enrollment_id?.trim();
  if (!enrollmentId) {
    return NextResponse.json({ success: false, error: "Inscription introuvable." }, { status: 400 });
  }

  const completedIds = Array.isArray(body.progress_meta?.completedModuleIds)
    ? body.progress_meta.completedModuleIds.filter((id) => typeof id === "string").slice(0, 80)
    : [];

  try {
    const supabase = await createServiceSupabase();
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id, course_id, progress_meta")
      .eq("id", enrollmentId)
      .maybeSingle();
    if (!enrollment) {
      return NextResponse.json({ success: false, error: "Inscription introuvable" }, { status: 404 });
    }

    const { data: course } = await supabase
      .from("courses")
      .select("id, store_id")
      .eq("id", enrollment.course_id)
      .maybeSingle();
    if (!course?.store_id) {
      return NextResponse.json({ success: false, error: "Cours introuvable" }, { status: 404 });
    }

    const access = await checkStoreAccess(
      auth.serviceSupabase,
      auth.userId,
      course.store_id as string,
      "read"
    );
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const { data: ownerStore } = await auth.serviceSupabase
      .from("stores")
      .select("id")
      .eq("id", course.store_id)
      .eq("owner_id", auth.userId)
      .maybeSingle();
    if (!ownerStore) {
      const { data: membership } = await auth.serviceSupabase
        .from("store_members")
        .select("role")
        .eq("store_id", course.store_id)
        .eq("user_id", auth.userId)
        .maybeSingle();
      if (membership?.role !== "manager") {
        return NextResponse.json(
          { success: false, error: "Accès refusé pour cette action." },
          { status: 403 }
        );
      }
    }

    const { data: modules } = await supabase
      .from("course_modules")
      .select("id")
      .eq("course_id", course.id)
      .order("sort_order");
    const orderedIds = (modules || []).map((row) => row.id as string);
    const allowed = new Set(orderedIds);
    const stored = (enrollment.progress_meta || {}) as Partial<LearnerProgressMeta>;
    const passed = new Set(
      (Array.isArray(stored.passedQuizModuleIds) ? stored.passedQuizModuleIds : []).filter((id) =>
        allowed.has(id)
      )
    );
    const completed = new Set(
      (Array.isArray(stored.completedModuleIds) ? stored.completedModuleIds : []).filter((id) =>
        allowed.has(id)
      )
    );
    for (const id of completedIds) {
      if (allowed.has(id)) completed.add(id);
    }

    let quizResult: { score: number; passed: boolean } | null = null;
    const attemptModule = body.quiz_attempt?.module_id?.trim() || "";
    const attemptAnswers = body.quiz_attempt?.answers;
    if (attemptModule && allowed.has(attemptModule) && attemptAnswers && typeof attemptAnswers === "object") {
      const { data: quizRow } = await supabase
        .from("course_quizzes")
        .select("questions, passing_score")
        .eq("course_id", course.id)
        .eq("module_id", attemptModule)
        .maybeSingle();
      const questions = (quizRow?.questions as QuizQuestion[]) ?? [];
      quizResult = gradeStoredQuiz(questions, Number(quizRow?.passing_score ?? 70), attemptAnswers);
      if (quizResult.passed) passed.add(attemptModule);
    }

    const safeMeta: LearnerProgressMeta = {
      completedModuleIds: [...completed],
      passedQuizModuleIds: [...passed],
    };
    const { data: quizRows } = await supabase
      .from("course_quizzes")
      .select("module_id, questions")
      .eq("course_id", course.id);
    const hasQuizByModuleId: Record<string, boolean> = {};
    for (const id of orderedIds) hasQuizByModuleId[id] = false;
    for (const row of quizRows || []) {
      const moduleId = row.module_id as string;
      if (!allowed.has(moduleId)) continue;
      hasQuizByModuleId[moduleId] = moduleHasQuiz({
        module_id: moduleId,
        course_id: course.id,
        title: "",
        passing_score: 70,
        questions: (row.questions as QuizQuestion[]) ?? [],
      });
    }

    const percent = computeProgressPercent(orderedIds, safeMeta, hasQuizByModuleId);
    const courseDone = percent >= 100;
    const { data, error } = await supabase
      .from("course_enrollments")
      .update({
        progress_percent: percent,
        progress_meta: safeMeta,
        completed_at: courseDone ? new Date().toISOString() : null,
      })
      .eq("id", enrollmentId)
      .eq("course_id", course.id)
      .select("id, student_name, progress_percent, progress_meta, completed_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Enregistrement impossible" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, enrollment: data, quiz: quizResult });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

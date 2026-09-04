import { NextResponse } from "next/server";
import { computeProgressPercent, moduleHasQuiz } from "@/lib/education-extras";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { LearnerProgressMeta, QuizQuestion } from "@/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const inviteCode = decodeURIComponent(code).trim().toLowerCase();
  const body = (await request.json().catch(() => ({}))) as {
    enrollment_id?: string;
    progress_meta?: LearnerProgressMeta;
  };

  const enrollmentId = body.enrollment_id?.trim();
  if (!inviteCode || !enrollmentId) {
    return NextResponse.json({ success: false, error: "Paramètres invalides" }, { status: 400 });
  }

  const meta: LearnerProgressMeta = {
    completedModuleIds: Array.isArray(body.progress_meta?.completedModuleIds)
      ? body.progress_meta.completedModuleIds.filter((id) => typeof id === "string").slice(0, 80)
      : [],
    passedQuizModuleIds: Array.isArray(body.progress_meta?.passedQuizModuleIds)
      ? body.progress_meta.passedQuizModuleIds.filter((id) => typeof id === "string").slice(0, 80)
      : [],
  };

  try {
    const supabase = await createServiceSupabase();
    const { data: course } = await supabase
      .from("courses")
      .select("id, is_public")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (!course?.is_public) {
      return NextResponse.json({ success: false, error: "Cours non public" }, { status: 403 });
    }

    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id, course_id")
      .eq("id", enrollmentId)
      .eq("course_id", course.id)
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json({ success: false, error: "Inscription introuvable" }, { status: 404 });
    }

    const { data: modules } = await supabase
      .from("course_modules")
      .select("id")
      .eq("course_id", course.id)
      .order("sort_order");
    const orderedIds = (modules || []).map((row) => row.id as string);
    const allowed = new Set(orderedIds);
    const safeMeta: LearnerProgressMeta = {
      completedModuleIds: meta.completedModuleIds.filter((id) => allowed.has(id)),
      passedQuizModuleIds: meta.passedQuizModuleIds.filter((id) => allowed.has(id)),
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
    const completed = percent >= 100;

    const { data, error } = await supabase
      .from("course_enrollments")
      .update({
        progress_percent: percent,
        progress_meta: safeMeta,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", enrollmentId)
      .select("id, student_name, progress_percent, progress_meta, completed_at")
      .single();

    if (error) {
      const fallback = await supabase
        .from("course_enrollments")
        .update({
          progress_percent: percent,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", enrollmentId)
        .select("id, student_name, progress_percent, completed_at")
        .single();
      if (fallback.error) {
        return NextResponse.json({ success: false, error: fallback.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, enrollment: fallback.data });
    }

    return NextResponse.json({ success: true, enrollment: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

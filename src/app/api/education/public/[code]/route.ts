import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { CourseModule, ModuleQuiz, QuizQuestion } from "@/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const inviteCode = decodeURIComponent(code).trim().toLowerCase();
  if (!inviteCode) {
    return NextResponse.json({ success: false, error: "Code invalide" }, { status: 400 });
  }

  try {
    const supabase = await createServiceSupabase();
    const { data: course, error } = await supabase
      .from("courses")
      .select("id, title, description, invite_code, is_public, store_id")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (error || !course) {
      return NextResponse.json({ success: false, error: "Cours introuvable" }, { status: 404 });
    }

    if (!course.is_public) {
      return NextResponse.json(
        { success: false, error: "Ce cours n'est pas ouvert au public" },
        { status: 403 }
      );
    }

    const { data: modules } = await supabase
      .from("course_modules")
      .select("*")
      .eq("course_id", course.id)
      .order("sort_order");

    const { data: quizRows } = await supabase
      .from("course_quizzes")
      .select("*")
      .eq("course_id", course.id);

    const quizzes: Record<string, ModuleQuiz> = {};
    for (const row of quizRows || []) {
      if (!row.module_id) continue;
      quizzes[row.module_id as string] = {
        module_id: row.module_id as string,
        course_id: course.id,
        title: row.title as string,
        passing_score: (row.passing_score as number) ?? 70,
        questions: (row.questions as QuizQuestion[]) ?? [],
      };
    }

    return NextResponse.json({
      success: true,
      course,
      modules: (modules || []) as CourseModule[],
      quizzes,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

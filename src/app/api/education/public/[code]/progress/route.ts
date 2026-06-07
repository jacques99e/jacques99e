import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { LearnerProgressMeta } from "@/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const inviteCode = decodeURIComponent(code).trim().toLowerCase();
  const body = (await request.json().catch(() => ({}))) as {
    enrollment_id?: string;
    progress_meta?: LearnerProgressMeta;
    progress_percent?: number;
  };

  const enrollmentId = body.enrollment_id?.trim();
  if (!inviteCode || !enrollmentId) {
    return NextResponse.json({ success: false, error: "Paramètres invalides" }, { status: 400 });
  }

  const percent = Math.min(100, Math.max(0, Number(body.progress_percent) || 0));
  const meta = body.progress_meta || { completedModuleIds: [], passedQuizModuleIds: [] };
  const completed = percent >= 100;

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

    const { data, error } = await supabase
      .from("course_enrollments")
      .update({
        progress_percent: percent,
        progress_meta: meta,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", enrollmentId)
      .select("*")
      .single();

    if (error) {
      const fallback = await supabase
        .from("course_enrollments")
        .update({
          progress_percent: percent,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", enrollmentId)
        .select("*")
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

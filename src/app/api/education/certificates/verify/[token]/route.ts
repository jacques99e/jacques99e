import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const certificateToken = decodeURIComponent(token).trim();
  if (!certificateToken) {
    return NextResponse.json({ success: false, error: "Token invalide" }, { status: 400 });
  }

  try {
    const supabase = await createServiceSupabase();
    const { data: enrollment, error } = await supabase
      .from("course_enrollments")
      .select(
        "id, student_name, progress_percent, completed_at, certificate_token, course_id, courses(title, invite_code)"
      )
      .eq("certificate_token", certificateToken)
      .maybeSingle();

    if (error || !enrollment) {
      return NextResponse.json(
        { success: false, valid: false, error: "Certificat introuvable ou non émis" },
        { status: 404 }
      );
    }

    const course = enrollment.courses as { title?: string; invite_code?: string } | null;
    const valid = (enrollment.progress_percent ?? 0) >= 100 && Boolean(enrollment.completed_at);

    return NextResponse.json({
      success: true,
      valid,
      certificate: {
        student_name: enrollment.student_name,
        course_title: course?.title || "Formation",
        progress_percent: enrollment.progress_percent,
        completed_at: enrollment.completed_at,
        token: enrollment.certificate_token,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { getOrCreateEnrollment } from "@/lib/education-enrollment";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    course_id?: string;
    student_name?: string;
    student_email?: string | null;
  };

  const courseId = body.course_id?.trim();
  const studentName = body.student_name?.trim();
  if (!courseId || !studentName) {
    return NextResponse.json(
      { success: false, error: "Cours et nom de l'apprenant requis" },
      { status: 400 }
    );
  }

  try {
    const service = await createServiceSupabase();
    const { data: course } = await service
      .from("courses")
      .select("id, store_id")
      .eq("id", courseId)
      .maybeSingle();

    if (!course?.store_id) {
      return NextResponse.json({ success: false, error: "Cours introuvable" }, { status: 404 });
    }

    const access = await checkStoreAccess(
      auth.serviceSupabase,
      auth.userId,
      course.store_id as string,
      "write"
    );
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error || "Accès refusé" },
        { status: access.status ?? 403 }
      );
    }

    const enrollment = await getOrCreateEnrollment(
      service,
      courseId,
      studentName,
      body.student_email
    );

    return NextResponse.json({ success: true, enrollment });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Inscription impossible";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

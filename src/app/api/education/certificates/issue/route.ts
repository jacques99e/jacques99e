import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { certificateVerifyUrl } from "@/lib/certificate";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    enrollment_id?: string;
    invite_code?: string;
  };
  const enrollmentId = body.enrollment_id?.trim();
  if (!enrollmentId) {
    return NextResponse.json({ success: false, error: "enrollment_id requis" }, { status: 400 });
  }

  try {
    const service = await createServiceSupabase();
    const { data: enrollment, error } = await service
      .from("course_enrollments")
      .select("id, course_id, progress_percent, certificate_token, completed_at")
      .eq("id", enrollmentId)
      .maybeSingle();

    if (error || !enrollment) {
      return NextResponse.json({ success: false, error: "Inscription introuvable" }, { status: 404 });
    }

    if ((enrollment.progress_percent ?? 0) < 100) {
      return NextResponse.json(
        { success: false, error: "Parcours non terminé (100 % requis)" },
        { status: 400 }
      );
    }

    const inviteCode = body.invite_code?.trim().toLowerCase();
    if (inviteCode) {
      const { data: course } = await service
        .from("courses")
        .select("id, invite_code, is_public")
        .eq("id", enrollment.course_id)
        .maybeSingle();
      if (
        !course?.is_public ||
        (course.invite_code || "").toLowerCase() !== inviteCode
      ) {
        return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
      }
    } else {
      const auth = await requireAuthContext();
      if (!auth.ok) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }
      const { data: course } = await service
        .from("courses")
        .select("store_id")
        .eq("id", enrollment.course_id)
        .maybeSingle();
      if (!course?.store_id) {
        return NextResponse.json({ success: false, error: "Cours introuvable" }, { status: 404 });
      }
      const { data: store } = await auth.serviceSupabase
        .from("stores")
        .select("id")
        .eq("id", course.store_id)
        .maybeSingle();
      if (!store) {
        return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
      }
    }

    let token = enrollment.certificate_token as string | null;
    if (!token) {
      token = randomBytes(16).toString("hex");
      const { error: updateError } = await service
        .from("course_enrollments")
        .update({
          certificate_token: token,
          completed_at: enrollment.completed_at || new Date().toISOString(),
        })
        .eq("id", enrollmentId);
      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      token,
      verify_url: certificateVerifyUrl(token),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

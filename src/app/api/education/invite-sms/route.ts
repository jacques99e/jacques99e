import { NextResponse } from "next/server";
import { requireAuthContext, checkStoreAccess } from "@/lib/api-auth";
import { buildFormationInviteSms, looksLikePhone, sendSms } from "@/lib/sms";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    course_id?: string;
    phone?: string;
    student_name?: string;
    enrollment_id?: string;
  };

  const courseId = body.course_id?.trim();
  const phone = body.phone?.trim();
  if (!courseId || !phone || !looksLikePhone(phone)) {
    return NextResponse.json(
      { success: false, error: "course_id et numéro de téléphone valide requis" },
      { status: 400 }
    );
  }

  try {
    const service = await createServiceSupabase();
    const { data: course, error: courseError } = await service
      .from("courses")
      .select("id, title, invite_code, is_public, store_id")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError || !course) {
      return NextResponse.json({ success: false, error: "Cours introuvable" }, { status: 404 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, course.store_id, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    if (!course.is_public || !course.invite_code) {
      return NextResponse.json(
        { success: false, error: "Activez le cours public pour envoyer une invitation" },
        { status: 400 }
      );
    }

    const base = (process.env.NEXT_PUBLIC_APP_URL || "https://app.wazo-digital.com").replace(
      /\/$/,
      ""
    );
    const link = `${base}/formation/${course.invite_code}`;
    const message = buildFormationInviteSms({
      studentName: body.student_name?.trim() || "Apprenant",
      courseTitle: course.title,
      inviteCode: course.invite_code,
      formationLink: link,
    });

    const sms = await sendSms(phone, message);
    if (!sms.ok) {
      return NextResponse.json({ success: false, error: sms.error }, { status: 502 });
    }

    if (body.enrollment_id) {
      await service
        .from("course_enrollments")
        .update({ invite_sms_sent_at: new Date().toISOString() })
        .eq("id", body.enrollment_id);
    }

    return NextResponse.json({
      success: true,
      simulated: sms.simulated ?? false,
      message: sms.simulated
        ? "SMS simulé (SMS_SIMULATE=true)"
        : "Invitation SMS envoyée",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

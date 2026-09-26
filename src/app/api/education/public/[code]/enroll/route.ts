import { NextResponse } from "next/server";
import { getOrCreateEnrollment } from "@/lib/education-enrollment";
import { allowIp, allowRequest } from "@/lib/rate-limit";
import { buildFormationInviteSms, looksLikePhone, sendSms } from "@/lib/sms";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  if (!(await allowIp(request, "formation-enroll", 8, 60 * 60 * 1000))) {
    return NextResponse.json(
      { success: false, error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 }
    );
  }
  const { code } = await context.params;
  const inviteCode = decodeURIComponent(code).trim().toLowerCase();
  const body = (await request.json().catch(() => ({}))) as {
    student_name?: string;
    student_email?: string | null;
    access_token?: string | null;
  };

  const studentName = body.student_name?.trim();
  if (!inviteCode || !studentName) {
    return NextResponse.json(
      { success: false, error: "Nom et code requis" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceSupabase();
    const { data: course } = await supabase
      .from("courses")
      .select("id, title, invite_code, is_public")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (!course?.is_public) {
      return NextResponse.json({ success: false, error: "Cours non public" }, { status: 403 });
    }

    const enrollment = await getOrCreateEnrollment(
      supabase,
      course.id,
      studentName,
      body.student_email,
      { accessToken: body.access_token }
    );

    const contact = body.student_email?.trim();
    const smsDigits = contact?.replace(/\D/g, "") || "";
    const smsAllowed =
      smsDigits.length >= 8 &&
      (await allowRequest(`formation-sms-phone:${smsDigits}`, 1, 24 * 60 * 60 * 1000)) &&
      (await allowIp(request, "formation-sms", 3, 60 * 60 * 1000));
    if (contact && looksLikePhone(contact) && course.invite_code && !enrollment.invite_sms_sent_at && smsAllowed) {
      const base = (process.env.NEXT_PUBLIC_APP_URL || "https://app.wazo-digital.com").replace(
        /\/$/,
        ""
      );
      const link = `${base}/formation/${course.invite_code}`;
      const message = buildFormationInviteSms({
        studentName: enrollment.student_name,
        courseTitle: course.title,
        inviteCode: course.invite_code,
        formationLink: link,
      });
      const sms = await sendSms(contact, message);
      if (sms.ok) {
        await supabase
          .from("course_enrollments")
          .update({ invite_sms_sent_at: new Date().toISOString() })
          .eq("id", enrollment.id);
      }
    }

    return NextResponse.json({
      success: true,
      enrollment: {
        id: enrollment.id,
        student_name: enrollment.student_name,
        progress_percent: enrollment.progress_percent,
        progress_meta: enrollment.progress_meta,
        completed_at: enrollment.completed_at,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

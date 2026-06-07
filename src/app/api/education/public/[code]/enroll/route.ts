import { NextResponse } from "next/server";
import { buildFormationInviteSms, looksLikePhone, sendSms } from "@/lib/sms";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const inviteCode = decodeURIComponent(code).trim().toLowerCase();
  const body = (await request.json().catch(() => ({}))) as {
    student_name?: string;
    student_email?: string | null;
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

    const { data: existing } = await supabase
      .from("course_enrollments")
      .select("id, student_name, progress_percent")
      .eq("course_id", course.id)
      .ilike("student_name", studentName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, enrollment: existing });
    }

    const { data, error } = await supabase
      .from("course_enrollments")
      .insert({
        course_id: course.id,
        student_name: studentName,
        student_email: body.student_email?.trim() || null,
        progress_percent: 0,
        progress_meta: { completedModuleIds: [], passedQuizModuleIds: [] },
      })
      .select("*")
      .single();

    if (error) {
      const fallback = await supabase
        .from("course_enrollments")
        .insert({
          course_id: course.id,
          student_name: studentName,
          student_email: body.student_email?.trim() || null,
          progress_percent: 0,
        })
        .select("*")
        .single();
      if (fallback.error) {
        return NextResponse.json({ success: false, error: fallback.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, enrollment: fallback.data });
    }

    const contact = body.student_email?.trim();
    if (contact && looksLikePhone(contact) && course.invite_code) {
      const base = (process.env.NEXT_PUBLIC_APP_URL || "https://wazo-digital.vercel.app").replace(
        /\/$/,
        ""
      );
      const link = `${base}/formation/${course.invite_code}`;
      const message = buildFormationInviteSms({
        studentName,
        courseTitle: course.title,
        inviteCode: course.invite_code,
        formationLink: link,
      });
      const sms = await sendSms(contact, message);
      if (sms.ok) {
        await supabase
          .from("course_enrollments")
          .update({ invite_sms_sent_at: new Date().toISOString() })
          .eq("id", data.id);
      }
    }

    return NextResponse.json({ success: true, enrollment: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

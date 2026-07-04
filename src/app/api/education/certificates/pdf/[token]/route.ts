import { NextResponse } from "next/server";
import {
  buildCertificatePdfBuffer,
  certificateContentDisposition,
  certificateFilename,
} from "@/lib/certificate-server";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const certificateToken = decodeURIComponent(token).trim();
  if (!certificateToken) {
    return NextResponse.json({ error: "Token invalide" }, { status: 400 });
  }

  try {
    const supabase = await createServiceSupabase();
    const { data: enrollment, error } = await supabase
      .from("course_enrollments")
      .select(
        "id, course_id, student_name, progress_percent, completed_at, certificate_token, courses(title, stores(name))"
      )
      .eq("certificate_token", certificateToken)
      .maybeSingle();

    if (error || !enrollment?.certificate_token) {
      return NextResponse.json({ error: "Certificat introuvable" }, { status: 404 });
    }

    if ((enrollment.progress_percent ?? 0) < 100 || !enrollment.completed_at) {
      return NextResponse.json({ error: "Parcours non terminé" }, { status: 403 });
    }

    const course = enrollment.courses as {
      title?: string;
      stores?: { name?: string } | null;
    } | null;

    const storeName = course?.stores?.name?.trim();

    const { count: moduleCount } = await supabase
      .from("course_modules")
      .select("id", { count: "exact", head: true })
      .eq("course_id", enrollment.course_id as string);

    const studentName = String(enrollment.student_name || "Apprenant");
    const courseTitle = course?.title?.trim() || "Formation";
    const orgName = storeName || "Wazo Digital";

    const pdf = await buildCertificatePdfBuffer({
      studentName,
      courseTitle,
      organizationName: orgName,
      instructorName: orgName,
      completedAt: String(enrollment.completed_at),
      verifyToken: certificateToken,
      moduleCount: moduleCount ?? undefined,
    });

    const filename = certificateFilename(studentName);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": certificateContentDisposition(filename),
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

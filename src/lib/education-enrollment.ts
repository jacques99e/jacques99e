import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseEnrollment } from "@/types";

/** Nom affiché : espaces normalisés, casse conservée. */
export function formatStudentName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Clé de dédoublonnage : minuscules, espaces uniques. */
export function normalizeStudentName(name: string): string {
  return formatStudentName(name).toLowerCase();
}

export function formatCertificateId(token: string): string {
  return `WZD-${token.slice(0, 8).toUpperCase()}`;
}

export async function findEnrollmentByStudentName(
  supabase: SupabaseClient,
  courseId: string,
  studentName: string
): Promise<CourseEnrollment | null> {
  const normalized = normalizeStudentName(studentName);
  const { data, error } = await supabase
    .from("course_enrollments")
    .select("*")
    .eq("course_id", courseId)
    .eq("student_name_normalized", normalized)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!error && data) return data as CourseEnrollment;

  const { data: legacyRows } = await supabase
    .from("course_enrollments")
    .select("*")
    .eq("course_id", courseId)
    .ilike("student_name", formatStudentName(studentName));

  const legacy = (legacyRows || []) as CourseEnrollment[];
  if (!legacy.length) return null;

  const match =
    legacy.find((row) => normalizeStudentName(row.student_name) === normalized) ?? legacy[0];

  if (match?.id) {
    await supabase
      .from("course_enrollments")
      .update({ student_name_normalized: normalized })
      .eq("id", match.id);
  }

  return match;
}

export async function getOrCreateEnrollment(
  supabase: SupabaseClient,
  courseId: string,
  studentName: string,
  studentEmail?: string | null
): Promise<CourseEnrollment> {
  const displayName = formatStudentName(studentName);
  if (!displayName) {
    throw new Error("Nom d'apprenant requis");
  }

  const normalized = normalizeStudentName(displayName);
  const existing = await findEnrollmentByStudentName(supabase, courseId, displayName);
  if (existing) {
    const email = studentEmail?.trim();
    if (email && !existing.student_email) {
      const { data: updated } = await supabase
        .from("course_enrollments")
        .update({ student_email: email })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updated) return updated as CourseEnrollment;
    }
    return existing;
  }

  const payload = {
    course_id: courseId,
    student_name: displayName,
    student_name_normalized: normalized,
    student_email: studentEmail?.trim() || null,
    progress_percent: 0,
    progress_meta: { completedModuleIds: [], passedQuizModuleIds: [] },
  };

  const { data, error } = await supabase
    .from("course_enrollments")
    .insert(payload)
    .select("*")
    .single();

  if (!error && data) return data as CourseEnrollment;

  if (error?.code === "23505") {
    const retry = await findEnrollmentByStudentName(supabase, courseId, displayName);
    if (retry) return retry;
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("course_enrollments")
    .insert({
      course_id: courseId,
      student_name: displayName,
      student_email: studentEmail?.trim() || null,
      progress_percent: 0,
    })
    .select("*")
    .single();

  if (fallbackError || !fallback) {
    throw new Error(fallbackError?.message || error?.message || "Inscription impossible");
  }

  return fallback as CourseEnrollment;
}

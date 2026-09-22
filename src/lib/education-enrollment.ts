import { randomBytes } from "crypto";
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

function newAccessToken(): string {
  return randomBytes(24).toString("hex");
}

/** Téléphone (8 chiffres min) ou e-mail. Un simple prénom ne compte pas. */
export function enrollmentContactKey(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase() || "";
  if (!raw) return null;
  if (raw.includes("@") && raw.includes(".")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

async function findEnrollmentByToken(
  supabase: SupabaseClient,
  courseId: string,
  accessToken: string
): Promise<CourseEnrollment | null> {
  const { data } = await supabase
    .from("course_enrollments")
    .select("*")
    .eq("course_id", courseId)
    .eq("access_token", accessToken)
    .maybeSingle();
  return (data as CourseEnrollment | null) ?? null;
}

async function findEnrollmentByContact(
  supabase: SupabaseClient,
  courseId: string,
  contact: string
): Promise<CourseEnrollment | null> {
  const key = enrollmentContactKey(contact);
  if (!key) return null;
  const { data } = await supabase
    .from("course_enrollments")
    .select("*")
    .eq("course_id", courseId)
    .not("student_email", "is", null)
    .limit(200);
  const rows = (data || []) as CourseEnrollment[];
  const matches = rows.filter((row) => enrollmentContactKey(row.student_email) === key);
  return matches.length === 1 ? matches[0] : null;
}

async function insertEnrollment(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<CourseEnrollment> {
  const { data, error } = await supabase
    .from("course_enrollments")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message || "Inscription impossible");
  }
  return data as CourseEnrollment;
}

export async function getOrCreateEnrollment(
  supabase: SupabaseClient,
  courseId: string,
  studentName: string,
  studentEmail?: string | null,
  options?: { accessToken?: string | null; resumeByName?: boolean }
): Promise<CourseEnrollment> {
  const displayName = formatStudentName(studentName);
  if (!displayName) {
    throw new Error("Nom d'apprenant requis");
  }

  const normalized = normalizeStudentName(displayName);
  const presentedToken = options?.accessToken?.trim() || "";
  if (presentedToken) {
    const byToken = await findEnrollmentByToken(supabase, courseId, presentedToken);
    if (byToken) return byToken;
  }

  if (!options?.resumeByName) {
    const byContact = await findEnrollmentByContact(supabase, courseId, studentEmail || "");
    if (byContact) return byContact;
  } else {
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
  }

  const payload = {
    course_id: courseId,
    student_name: displayName,
    student_name_normalized: normalized,
    student_email: studentEmail?.trim() || null,
    access_token: newAccessToken(),
    progress_percent: 0,
    progress_meta: { completedModuleIds: [], passedQuizModuleIds: [] },
  };

  try {
    return await insertEnrollment(supabase, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("access_token")) throw error;
    return insertEnrollment(supabase, { ...payload, access_token: newAccessToken() });
  }
}

import { randomBytes } from "crypto";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { ensureEnrollmentCompleted, type CompletionClientContext } from "@/lib/education-progress-server";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { LearnerProgressMeta } from "@/types";

export interface CertificateIssueInput {
  enrollment_id?: string;
  invite_code?: string;
  progress_meta?: LearnerProgressMeta;
  ordered_module_ids?: string[];
  has_quiz_by_module_id?: Record<string, boolean>;
}

export type CertificateIssueResult =
  | {
      ok: true;
      enrollmentId: string;
      token: string;
      studentName: string;
      completedAt: string | null;
    }
  | { ok: false; status: number; error: string };

function clientContextFromBody(body: CertificateIssueInput): CompletionClientContext {
  return {
    orderedModuleIds: body.ordered_module_ids,
    hasQuizByModuleId: body.has_quiz_by_module_id,
  };
}

export async function issueCertificateForEnrollment(
  body: CertificateIssueInput
): Promise<CertificateIssueResult> {
  const enrollmentId = body.enrollment_id?.trim();
  if (!enrollmentId) {
    return { ok: false, status: 400, error: "Inscription introuvable." };
  }

  const service = await createServiceSupabase();
  const { data: enrollment, error } = await service
    .from("course_enrollments")
    .select(
      "id, course_id, student_name, progress_percent, progress_meta, certificate_token, completed_at"
    )
    .eq("id", enrollmentId)
    .maybeSingle();

  if (error || !enrollment) {
    return { ok: false, status: 404, error: "Inscription introuvable." };
  }

  const completion = await ensureEnrollmentCompleted(
    service,
    enrollment,
    body.progress_meta,
    clientContextFromBody(body)
  );
  if (!completion.ok) {
    return { ok: false, status: 400, error: "Parcours non terminé (100 % requis)." };
  }

  const inviteCode = body.invite_code?.trim().toLowerCase();
  let authorized = false;

  if (inviteCode) {
    const { data: course } = await service
      .from("courses")
      .select("id, invite_code, is_public")
      .eq("id", enrollment.course_id)
      .maybeSingle();
    if (
      course?.is_public &&
      (course.invite_code || "").toLowerCase() === inviteCode
    ) {
      authorized = true;
    }
  }

  if (!authorized) {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return { ok: false, status: auth.status, error: auth.error };
    }
    const { data: course } = await service
      .from("courses")
      .select("store_id")
      .eq("id", enrollment.course_id)
      .maybeSingle();
    if (!course?.store_id) {
      return { ok: false, status: 404, error: "Cours introuvable." };
    }
    const access = await checkStoreAccess(
      auth.serviceSupabase,
      auth.userId,
      course.store_id as string,
      "read"
    );
    if (!access.ok) {
      return { ok: false, status: access.status ?? 403, error: access.error || "Accès refusé." };
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
      return { ok: false, status: 500, error: updateError.message };
    }
  }

  return {
    ok: true,
    enrollmentId,
    token,
    studentName: enrollment.student_name as string,
    completedAt: (enrollment.completed_at as string | null) ?? null,
  };
}

import type { Course, CourseEnrollment, CourseModule, ModuleQuiz } from "@/types";
import { PROD_APP_URL } from "@/lib/site-urls";

export interface PublicCoursePayload {
  course: Course;
  modules: CourseModule[];
  quizzes: Record<string, ModuleQuiz>;
}

export function formationUrl(inviteCode: string): string {
  if (typeof window === "undefined") {
    return `${PROD_APP_URL}/formation/${inviteCode}`;
  }
  return `${window.location.origin}/formation/${encodeURIComponent(inviteCode)}`;
}

export async function fetchPublicCourse(code: string): Promise<PublicCoursePayload> {
  const res = await fetch(`/api/education/public/${encodeURIComponent(code)}`);
  const json = (await res.json()) as {
    success: boolean;
    error?: string;
    course?: Course;
    modules?: CourseModule[];
    quizzes?: Record<string, ModuleQuiz>;
  };
  if (!res.ok || !json.success || !json.course) {
    throw new Error(json.error || "Cours introuvable");
  }
  return {
    course: json.course,
    modules: json.modules || [],
    quizzes: json.quizzes || {},
  };
}

export async function enrollPublicStudent(
  code: string,
  studentName: string,
  studentContact?: string
): Promise<CourseEnrollment> {
  const res = await fetch(`/api/education/public/${encodeURIComponent(code)}/enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      student_name: studentName,
      student_email: studentContact || null,
    }),
  });
  const json = (await res.json()) as {
    success: boolean;
    error?: string;
    enrollment?: CourseEnrollment;
  };
  if (!res.ok || !json.success || !json.enrollment) {
    throw new Error(json.error || "Inscription impossible");
  }
  return json.enrollment;
}

const SESSION_KEY = "wazo_formation_session";

export function saveFormationSession(code: string, enrollment: CourseEnrollment) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ code: code.toLowerCase(), enrollment })
  );
}

export function loadFormationSession(code: string): CourseEnrollment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code: string; enrollment: CourseEnrollment };
    if (parsed.code !== code.toLowerCase()) return null;
    return parsed.enrollment;
  } catch {
    return null;
  }
}

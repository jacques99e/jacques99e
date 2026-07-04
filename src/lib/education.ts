import { db } from "@/lib/db";
import { apiFetch } from "@/lib/api-client";
import { normalizeStudentName } from "@/lib/education-enrollment";
import { supabase } from "@/lib/supabase/client";
import { generateLocalId } from "@/lib/sync";
import type { Course, CourseEnrollment, CourseModule } from "@/types";

export interface CreateCourseModuleResult {
  module: CourseModule;
  synced: boolean;
  reason?: "offline" | "supabase_error";
  message?: string;
}

function localModulesKey(courseId: string): string {
  return `wazo_course_modules_${courseId}`;
}

function readLocalModules(courseId: string): CourseModule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(localModulesKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CourseModule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalModules(courseId: string, modules: CourseModule[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(localModulesKey(courseId), JSON.stringify(modules));
}

async function syncPendingModules(courseId: string): Promise<CourseModule[]> {
  const local = readLocalModules(courseId);
  const pending = local.filter((m) => m.id.startsWith("local-"));
  if (!pending.length || !navigator.onLine) return local;

  let next = [...local];

  for (const courseModule of pending) {
    try {
      const response = await apiFetch("/api/education/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          title: courseModule.title,
          content: courseModule.content ?? null,
          media_url: courseModule.media_url ?? null,
          sort_order:
            typeof courseModule.sort_order === "number" ? courseModule.sort_order : 0,
        }),
      });
      const payload = (await response.json()) as {
        success: boolean;
        module?: CourseModule;
      };
      if (response.ok && payload.success && payload.module) {
        next = next.map((item) =>
          item.id === courseModule.id ? payload.module! : item
        );
      }
    } catch {
      // Keep pending for next refresh.
    }
  }

  writeLocalModules(courseId, next);
  return next;
}

export async function listCourses(storeId: string): Promise<Course[]> {
  if (db) {
    const local = await db.courses.where("store_id").equals(storeId).toArray();
    if (local.length || !navigator.onLine) return local;
  }
  if (!navigator.onLine) return [];
  const { data } = await supabase.from("courses").select("*").eq("store_id", storeId);
  if (data && db) await db.courses.bulkPut(data);
  return data || [];
}

export async function saveCourse(
  storeId: string,
  course: Partial<Course> & { title: string }
): Promise<Course> {
  const localId = course.id || generateLocalId();
  const record: Course = {
    id: localId,
    store_id: storeId,
    title: course.title,
    description: course.description ?? null,
    is_public: course.is_public ?? false,
    _localId: localId.startsWith("local-") ? localId : undefined,
    _pendingSync: true,
  };
  if (db) await db.courses.put(record);
  if (navigator.onLine) {
    try {
      const response = await apiFetch("/api/education/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          title: record.title,
          description: record.description,
          is_public: record.is_public,
        }),
      });
      const payload = (await response.json()) as { course?: Course; error?: string };
      if (response.ok && payload.course) {
        record.id = payload.course.id;
        record.invite_code = payload.course.invite_code;
        record._pendingSync = false;
        if (db) {
          if (localId.startsWith("local-")) await db.courses.delete(localId);
          await db.courses.put(record);
        }
        return record;
      }
      throw new Error(payload.error || "Impossible d'enregistrer le cours en ligne.");
    } catch {
      // Offline or API error: keep local Dexie record.
    }
  }
  return record;
}

export async function setCoursePublic(courseId: string, isPublic: boolean): Promise<void> {
  if (db) {
    const existing = await db.courses.get(courseId);
    if (existing) await db.courses.put({ ...existing, is_public: isPublic });
  }
  if (navigator.onLine) {
    await supabase.from("courses").update({ is_public: isPublic }).eq("id", courseId);
  }
}

export async function listModules(courseId: string): Promise<CourseModule[]> {
  const local = await syncPendingModules(courseId);
  if (!navigator.onLine) return local;
  const { data, error } = await supabase
    .from("course_modules")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order");
  if (error) return local;
  const rows = data || [];
  writeLocalModules(courseId, rows);
  return rows;
}

export async function listEnrollments(courseId: string): Promise<CourseEnrollment[]> {
  if (!navigator.onLine) return [];
  const { data } = await supabase
    .from("course_enrollments")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  const rows = (data || []) as CourseEnrollment[];
  const byName = new Map<string, CourseEnrollment>();
  for (const row of rows) {
    const key = normalizeStudentName(row.student_name);
    const prev = byName.get(key);
    if (!prev || (row.progress_percent ?? 0) > (prev.progress_percent ?? 0)) {
      byName.set(key, row);
    }
  }
  return [...byName.values()].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

export async function createCourseModule(
  courseId: string,
  input: Pick<CourseModule, "title"> & { content?: string | null; media_url?: string | null }
): Promise<CreateCourseModuleResult> {
  const existing = readLocalModules(courseId);
  const nextOrder =
    existing.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0) + 1;
  const localRow: CourseModule = {
    id: generateLocalId(),
    course_id: courseId,
    title: input.title,
    content: input.content ?? null,
    media_url: input.media_url?.trim() || null,
    sort_order: nextOrder,
  };
  const local = [localRow, ...readLocalModules(courseId)];
  writeLocalModules(courseId, local);

  if (!navigator.onLine) {
    return {
      module: localRow,
      synced: false,
      reason: "offline",
      message: "Hors ligne: module sauvegarde localement, synchronisation en attente.",
    };
  }

  try {
    const response = await apiFetch("/api/education/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: courseId,
        title: input.title,
        content: input.content ?? null,
        media_url: input.media_url?.trim() || null,
        sort_order: nextOrder,
      }),
    });
    const payload = (await response.json()) as {
      success: boolean;
      module?: CourseModule;
      error?: string;
    };
    if (response.ok && payload.success && payload.module) {
      const merged = readLocalModules(courseId).map((item) =>
        item.id === localRow.id ? payload.module! : item
      );
      writeLocalModules(courseId, merged);
      return { module: payload.module, synced: true };
    }
    return {
      module: localRow,
      synced: false,
      reason: "supabase_error",
      message: payload.error || "Synchronisation module impossible.",
    };
  } catch (error) {
    return {
      module: localRow,
      synced: false,
      reason: "supabase_error",
      message: error instanceof Error ? error.message : "Synchronisation module impossible.",
    };
  }
}

export async function updateCourseModule(
  moduleId: string,
  courseId: string,
  input: Partial<Pick<CourseModule, "title" | "content" | "media_url">>
): Promise<CourseModule | null> {
  const local = readLocalModules(courseId);
  const idx = local.findIndex((m) => m.id === moduleId);
  if (idx < 0) return null;

  const updated: CourseModule = {
    ...local[idx],
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.media_url !== undefined ? { media_url: input.media_url } : {}),
  };
  local[idx] = updated;
  writeLocalModules(courseId, local);

  if (!navigator.onLine || moduleId.startsWith("local-")) return updated;

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.content !== undefined) patch.content = input.content;
  if (input.media_url !== undefined) patch.media_url = input.media_url;

  const { data, error } = await supabase
    .from("course_modules")
    .update(patch)
    .eq("id", moduleId)
    .eq("course_id", courseId)
    .select("*")
    .single();

  if (error || !data) return updated;
  const merged = readLocalModules(courseId).map((m) =>
    m.id === moduleId ? (data as CourseModule) : m
  );
  writeLocalModules(courseId, merged);
  return data as CourseModule;
}

export async function deleteCourseModule(moduleId: string, courseId: string): Promise<void> {
  writeLocalModules(
    courseId,
    readLocalModules(courseId).filter((m) => m.id !== moduleId)
  );
  if (!navigator.onLine || moduleId.startsWith("local-")) return;
  await supabase.from("course_modules").delete().eq("id", moduleId).eq("course_id", courseId);
}

export async function reorderCourseModules(
  courseId: string,
  orderedModuleIds: string[]
): Promise<void> {
  const local = readLocalModules(courseId);
  const byId = new Map(local.map((m) => [m.id, m]));
  const reordered = orderedModuleIds
    .map((id, index) => {
      const row = byId.get(id);
      return row ? { ...row, sort_order: index + 1 } : null;
    })
    .filter((row): row is CourseModule => Boolean(row));
  writeLocalModules(courseId, reordered);

  if (!navigator.onLine) return;

  await Promise.all(
    reordered.map((row) =>
      supabase
        .from("course_modules")
        .update({ sort_order: row.sort_order })
        .eq("id", row.id)
        .eq("course_id", courseId)
    )
  );
}

export async function createEnrollment(
  courseId: string,
  input: Pick<CourseEnrollment, "student_name"> & { student_email?: string | null }
): Promise<CourseEnrollment | null> {
  if (!navigator.onLine) return null;

  const response = await apiFetch("/api/education/enrollments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      course_id: courseId,
      student_name: input.student_name,
      student_email: input.student_email ?? null,
    }),
  });

  const payload = (await response.json()) as {
    success: boolean;
    enrollment?: CourseEnrollment;
    error?: string;
  };

  if (!response.ok || !payload.success || !payload.enrollment) {
    throw new Error(payload.error || "Inscription impossible");
  }

  return payload.enrollment;
}

export async function generateCertificatePdf(
  studentName: string,
  courseTitle: string,
  instructorName: string
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(22);
  doc.text("Certificat de complétion", 148, 40, { align: "center" });
  doc.setFontSize(14);
  doc.text(`Décerné à ${studentName}`, 148, 70, { align: "center" });
  doc.text(`Pour le cours: ${courseTitle}`, 148, 85, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Formateur: ${instructorName} — Wazo Digital`, 148, 120, { align: "center" });
  doc.text(new Date().toLocaleDateString(), 148, 135, { align: "center" });
  return doc.output("blob");
}

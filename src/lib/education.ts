import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { generateLocalId } from "@/lib/sync";
import type { Course, CourseEnrollment, CourseModule } from "@/types";

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
    const { data } = await supabase
      .from("courses")
      .upsert({
        id: localId.startsWith("local-") ? undefined : localId,
        store_id: storeId,
        title: record.title,
        description: record.description,
        is_public: record.is_public,
      })
      .select()
      .single();
    if (data) {
      record.id = data.id;
      record.invite_code = data.invite_code;
      record._pendingSync = false;
      if (db) await db.courses.put(record);
    }
  }
  return record;
}

export async function listModules(courseId: string): Promise<CourseModule[]> {
  if (!navigator.onLine) return [];
  const { data } = await supabase
    .from("course_modules")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order");
  return data || [];
}

export async function listEnrollments(courseId: string): Promise<CourseEnrollment[]> {
  if (!navigator.onLine) return [];
  const { data } = await supabase.from("course_enrollments").select("*").eq("course_id", courseId);
  return data || [];
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

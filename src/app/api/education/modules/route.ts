import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { CourseModule } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      course_id?: string;
      title?: string;
      content?: string | null;
      media_url?: string | null;
      sort_order?: number;
    };

    const courseId = body.course_id?.trim();
    if (!courseId) {
      return NextResponse.json({ success: false, error: "Cours introuvable." }, { status: 400 });
    }

    const service = await createServiceSupabase();
    const { data: course, error: courseError } = await service
      .from("courses")
      .select("store_id")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError || !course?.store_id) {
      return NextResponse.json({ success: false, error: "Cours introuvable." }, { status: 404 });
    }

    const access = await checkStoreAccess(
      auth.serviceSupabase,
      auth.userId,
      course.store_id as string,
      "write"
    );
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ success: false, error: "Titre du module requis." }, { status: 400 });
    }

    const { data, error } = await service
      .from("course_modules")
      .insert({
        course_id: courseId,
        title,
        content: body.content ?? null,
        media_url: body.media_url?.trim() || null,
        sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Enregistrement impossible." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, module: data as CourseModule });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer le module." },
      { status: 500 }
    );
  }
}

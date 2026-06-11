import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";

/** Archive une feuille de présence côté cloud (audit bailleurs). */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      store_id?: string;
      course_title?: string;
      session_date?: string;
      records?: Array<{ student_name: string; present: boolean }>;
    };

    const courseTitle = body.course_title?.trim();
    const sessionDate = body.session_date?.trim();
    if (!courseTitle || !sessionDate || !body.records?.length) {
      return NextResponse.json({ success: false, error: "Données incomplètes." }, { status: 400 });
    }

    const { data: ownedStore } = await auth.serviceSupabase
      .from("stores")
      .select("id")
      .eq("owner_id", auth.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const storeId = body.store_id ?? ownedStore?.id;
    if (!storeId) {
      return NextResponse.json({ success: false, error: "Boutique introuvable." }, { status: 404 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status ?? 403 }
      );
    }

    const present = body.records.filter((r) => r.present).length;
    const rate = Math.round((present / body.records.length) * 100);
    const now = new Date().toISOString();

    const { data: course } = await auth.serviceSupabase
      .from("courses")
      .select("id, description")
      .eq("store_id", storeId)
      .ilike("title", `%${courseTitle.slice(0, 40)}%`)
      .limit(1)
      .maybeSingle();

    if (course?.id) {
      const stamp = `[Présence ${sessionDate}: ${present}/${body.records.length} — ${rate}%]`;
      const description = [course.description, stamp].filter(Boolean).join("\n").slice(-2000);
      await auth.serviceSupabase
        .from("courses")
        .update({ description })
        .eq("id", course.id);
    }

    return NextResponse.json({
      success: true,
      present,
      total: body.records.length,
      rate,
      synced_at: now,
      archived: Boolean(course?.id),
    });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur sync présence." }, { status: 500 });
  }
}

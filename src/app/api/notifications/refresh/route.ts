import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { refreshStoreEvolution } from "@/lib/evolution-notify";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { store_id?: string };
  const storeId = body.store_id?.trim();
  if (!storeId) {
    return NextResponse.json({ success: false, error: "store_id requis." }, { status: 400 });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const service = await createServiceSupabase();
  const result = await refreshStoreEvolution(service, storeId, {
    email: false,
    push: false,
  });
  return NextResponse.json({ success: true, ...result });
}

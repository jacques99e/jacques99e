import { NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const storeId = new URL(request.url).searchParams.get("store_id");
  if (!storeId) {
    return NextResponse.json({ success: false, error: "store_id requis" }, { status: 400 });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "read");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const { data, error } = await auth.serviceSupabase
    .from("store_members")
    .select("id, role, created_at, profiles(id, phone, full_name)")
    .eq("store_id", storeId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, members: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as {
    store_id?: string;
    phone?: string;
    role?: string;
  };

  if (!body.store_id || !body.phone?.trim()) {
    return NextResponse.json(
      { success: false, error: "store_id et phone requis" },
      { status: 400 }
    );
  }

  const { data: store } = await auth.serviceSupabase
    .from("stores")
    .select("id")
    .eq("id", body.store_id)
    .eq("owner_id", auth.userId)
    .maybeSingle();

  if (!store) {
    return NextResponse.json(
      { success: false, error: "Seul le propriétaire peut inviter des membres." },
      { status: 403 }
    );
  }

  const role = body.role || "employee";
  if (!["employee", "manager", "accountant"].includes(role)) {
    return NextResponse.json({ success: false, error: "Rôle invalide" }, { status: 400 });
  }

  const phone = body.phone.trim();
  const { data: profile } = await auth.serviceSupabase
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Utilisateur introuvable. Il doit d'abord créer un compte Wazo avec ce numéro.",
      },
      { status: 404 }
    );
  }

  const { data, error } = await auth.serviceSupabase
    .from("store_members")
    .upsert(
      {
        store_id: body.store_id,
        user_id: profile.id,
        role,
      },
      { onConflict: "store_id,user_id" }
    )
    .select("id, role, profiles(phone, full_name)")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, member: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store_id");
  const memberId = searchParams.get("member_id");

  if (!storeId || !memberId) {
    return NextResponse.json(
      { success: false, error: "store_id et member_id requis" },
      { status: 400 }
    );
  }

  const { data: store } = await auth.serviceSupabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_id", auth.userId)
    .maybeSingle();

  if (!store) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const { error } = await auth.serviceSupabase
    .from("store_members")
    .delete()
    .eq("id", memberId)
    .eq("store_id", storeId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

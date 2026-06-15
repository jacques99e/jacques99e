import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { getOwnerStoreAccess } from "@/lib/plan-access";
import { slugify } from "@/lib/utils";

export async function GET() {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const access = await getOwnerStoreAccess(auth.serviceSupabase, auth.userId);
    return NextResponse.json({ success: true, ...access });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de charger les limites boutiques." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      phone?: string;
      modules?: string[];
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Nom de boutique requis." }, { status: 400 });
    }

    const access = await getOwnerStoreAccess(auth.serviceSupabase, auth.userId);
    if (!access.canCreateStore) {
      const upgradePlan = access.effectivePlan === "starter" ? "PRO" : "BUSINESS";
      return NextResponse.json(
        {
          success: false,
          error: `Limite atteinte (${access.limits.maxStores} boutique(s)). Passez au plan ${upgradePlan} pour en créer davantage.`,
          ...access,
        },
        { status: 403 }
      );
    }

    const baseSlug = slugify(body.slug?.trim() || name);
    let candidateSlug = baseSlug;
    let savedStore: { id: string; name: string; slug: string } | null = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await auth.serviceSupabase
        .from("stores")
        .insert({
          owner_id: auth.userId,
          name,
          slug: candidateSlug,
          phone: body.phone?.trim() || null,
          whatsapp: body.phone?.trim() || null,
          is_public: true,
        })
        .select("id, name, slug")
        .single();

      if (!error && data) {
        savedStore = data;
        break;
      }

      if (error?.code === "23505") {
        const suffix = Math.random().toString(36).slice(2, 6);
        candidateSlug = `${baseSlug}-${suffix}`;
        continue;
      }

      return NextResponse.json(
        { success: false, error: error?.message || "Impossible de créer la boutique." },
        { status: 500 }
      );
    }

    if (!savedStore) {
      return NextResponse.json(
        { success: false, error: "Impossible de générer une URL publique unique." },
        { status: 500 }
      );
    }

    const modules = Array.isArray(body.modules) && body.modules.length ? body.modules : ["commerce"];
    await auth.serviceSupabase.from("store_modules").insert(
      modules.map((module_id) => ({
        store_id: savedStore!.id,
        module_id,
        enabled: true,
      }))
    );

    const now = new Date().toISOString();
    await auth.serviceSupabase.from("billing_subscriptions").upsert(
      {
        store_id: savedStore.id,
        plan: "starter",
        status: "trial",
        trial_start: now.slice(0, 10),
        trial_days: 14,
        updated_at: now,
      },
      { onConflict: "store_id" }
    );

    return NextResponse.json({ success: true, store: savedStore });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de créer la boutique." },
      { status: 500 }
    );
  }
}

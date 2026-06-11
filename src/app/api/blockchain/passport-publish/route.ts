import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      asset_hash?: string;
      store_id?: string;
      passport?: {
        productName?: string;
        cooperative?: string;
        region?: string;
        harvestDate?: string;
        certifications?: string[];
        farmerStory?: string;
        carbonEstimateKg?: number;
      };
    };

    const hash = body.asset_hash?.trim().toLowerCase();
    if (!hash || !body.passport?.productName) {
      return NextResponse.json({ success: false, error: "hash et passeport requis." }, { status: 400 });
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

    const { data: asset, error } = await auth.serviceSupabase
      .from("blockchain_assets")
      .select("id, metadata")
      .eq("store_id", storeId)
      .ilike("hash_sha256", `${hash}%`)
      .maybeSingle();

    if (error || !asset) {
      return NextResponse.json({ success: false, error: "Actif blockchain introuvable." }, { status: 404 });
    }

    const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
    await auth.serviceSupabase
      .from("blockchain_assets")
      .update({
        metadata: {
          ...metadata,
          passport: {
            productName: body.passport.productName,
            cooperative: body.passport.cooperative,
            region: body.passport.region,
            harvestDate: body.passport.harvestDate,
            certifications: body.passport.certifications ?? [],
            farmerStory: body.passport.farmerStory,
            carbonEstimateKg: body.passport.carbonEstimateKg,
            published_at: new Date().toISOString(),
          },
        },
      })
      .eq("id", asset.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur publication passeport." }, { status: 500 });
  }
}

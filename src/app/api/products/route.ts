import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { isProductUuid, productToRow, rowToProduct } from "@/lib/product-db-map";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const storeId =
      request.nextUrl.searchParams.get("storeId") ??
      request.nextUrl.searchParams.get("store_id");
    if (!storeId) {
      return NextResponse.json({ success: false, error: "storeId requis." }, { status: 400 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "read");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const service = await createServiceSupabase();
    const { data, error } = await service
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("name");

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      products: (data || []).map((row) => rowToProduct(row as Record<string, unknown>)),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de charger les produits." },
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
      store_id?: string;
      id?: string;
      name?: string;
      description?: string | null;
      barcode?: string | null;
      image_url?: string | null;
      price?: number;
      stock_quantity?: number;
      category?: string | null;
    };

    const storeId = body.store_id?.trim();
    if (!storeId) {
      return NextResponse.json({ success: false, error: "Boutique introuvable." }, { status: 400 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Nom du produit requis." }, { status: 400 });
    }

    const price = Number(body.price);
    const stock_quantity = Number(body.stock_quantity);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ success: false, error: "Prix invalide." }, { status: 400 });
    }
    if (!Number.isFinite(stock_quantity) || stock_quantity < 0) {
      return NextResponse.json({ success: false, error: "Stock invalide." }, { status: 400 });
    }

    const hasServerId = Boolean(body.id && isProductUuid(body.id));
    const row = productToRow({
      id: hasServerId ? body.id : undefined,
      store_id: storeId,
      name,
      description: body.description ?? null,
      price,
      stock_quantity,
      barcode: body.barcode ?? null,
      image_url: body.image_url ?? null,
      category: body.category ?? null,
    });

    const service = await createServiceSupabase();
    const query = hasServerId
      ? service.from("products").update(row).eq("id", body.id!).eq("store_id", storeId).select().single()
      : service.from("products").insert(row).select().single();

    const { data, error } = await query;
    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Enregistrement impossible." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      product: rowToProduct(data as Record<string, unknown>),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer le produit." },
      { status: 500 }
    );
  }
}

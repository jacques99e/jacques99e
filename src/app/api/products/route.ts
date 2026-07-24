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
      landing_content?: unknown;
      landing_published?: boolean;
      slug?: string;
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
      // Omit image_url on updates that don't send it → keep existing photo_url.
      image_url: body.image_url === undefined ? undefined : body.image_url,
      category: body.category ?? null,
    });

    if (body.landing_content != null) {
      row.landing_content = body.landing_content;
    }
    if (typeof body.landing_published === "boolean") {
      row.landing_published = body.landing_published;
    }
    if (body.slug?.trim()) {
      row.slug = body.slug.trim();
    }

    const service = await createServiceSupabase();
    const query = hasServerId
      ? service.from("products").update(row).eq("id", body.id!).eq("store_id", storeId).select().single()
      : service.from("products").insert(row).select().single();

    let { data, error } = await query;

    // Si colonnes landing absentes (migration 017 non appliquée), réessayer sans.
    if (
      error &&
      (body.landing_content != null ||
        typeof body.landing_published === "boolean" ||
        body.slug?.trim())
    ) {
      delete row.landing_content;
      delete row.landing_published;
      delete row.slug;
      const retry = hasServerId
        ? service.from("products").update(row).eq("id", body.id!).eq("store_id", storeId).select().single()
        : service.from("products").insert(row).select().single();
      ({ data, error } = await retry);
    }
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

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as { id?: string; store_id?: string };
    const id = body.id?.trim();
    const storeId = body.store_id?.trim();

    if (!id || !storeId) {
      return NextResponse.json(
        { success: false, error: "Identifiant produit et boutique requis." },
        { status: 400 }
      );
    }

    if (!isProductUuid(id)) {
      return NextResponse.json({ success: true, deleted: false, local_only: true });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const service = await createServiceSupabase();
    const { error } = await service.from("products").delete().eq("id", id).eq("store_id", storeId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || "Suppression impossible." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de supprimer le produit." },
      { status: 500 }
    );
  }
}

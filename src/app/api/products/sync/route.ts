import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { isProductUuid, productToRow, rowToProduct } from "@/lib/product-db-map";
import { createServiceSupabase } from "@/lib/supabase/server";

type SyncProductInput = {
  id?: string;
  name?: string;
  description?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  price?: number;
  stock_quantity?: number;
  category?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      store_id?: string;
      products?: SyncProductInput[];
    };

    const storeId = body.store_id?.trim();
    if (!storeId) {
      return NextResponse.json({ success: false, error: "Boutique introuvable." }, { status: 400 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const items = Array.isArray(body.products) ? body.products : [];
    if (items.length === 0) {
      return NextResponse.json({ success: true, synced: 0, products: [], errors: [] });
    }

    const service = await createServiceSupabase();
    const saved: ReturnType<typeof rowToProduct>[] = [];
    const errors: string[] = [];

    for (const item of items) {
      const name = item.name?.trim();
      if (!name) {
        errors.push("Produit sans nom ignoré.");
        continue;
      }

      const price = Number(item.price);
      const stock_quantity = Number(item.stock_quantity);
      if (!Number.isFinite(price) || price < 0) {
        errors.push(`${name}: prix invalide.`);
        continue;
      }
      if (!Number.isFinite(stock_quantity) || stock_quantity < 0) {
        errors.push(`${name}: stock invalide.`);
        continue;
      }

      const hasServerId = Boolean(item.id && isProductUuid(item.id));
      const row = productToRow({
        id: hasServerId ? item.id : undefined,
        store_id: storeId,
        name,
        description: item.description ?? null,
        price,
        stock_quantity,
        barcode: item.barcode ?? null,
        image_url: item.image_url ?? null,
        category: item.category ?? null,
      });

      const query = hasServerId
        ? service
            .from("products")
            .update(row)
            .eq("id", item.id!)
            .eq("store_id", storeId)
            .select()
            .single()
        : service.from("products").insert(row).select().single();

      const { data, error } = await query;
      if (error || !data) {
        errors.push(`${name}: ${error?.message || "échec"}`);
        continue;
      }

      saved.push(rowToProduct(data as Record<string, unknown>));
    }

    return NextResponse.json({
      success: true,
      synced: saved.length,
      products: saved,
      errors,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de synchroniser les produits." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { replaceSaleItems, saleItemProductId, upsertSaleByExternalId } from "@/lib/sale-cloud";
import { createServiceSupabase } from "@/lib/supabase/server";

type SaleItemBody = {
  product_id?: string | null;
  product_name?: string;
  name?: string;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
  subtotal?: number;
};

/** GET /api/sales?storeId= — historique ventes + lignes (service role). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const storeId =
      request.nextUrl.searchParams.get("storeId")?.trim() ||
      request.nextUrl.searchParams.get("store_id")?.trim();
    if (!storeId) {
      return NextResponse.json({ success: false, error: "storeId requis." }, { status: 400 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "read");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const service = await createServiceSupabase();
    const { data, error } = await service
      .from("sales")
      .select(
        `
        id,
        external_local_id,
        total_amount,
        total,
        payment_method,
        payment_status,
        created_at,
        sale_items (
          product_id,
          product_name,
          quantity,
          unit_price,
          subtotal
        )
      `
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sales: data || [] });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de charger les ventes." },
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
      external_local_id?: string;
      total?: number;
      total_amount?: number;
      payment_method?: string;
      payment_status?: string;
      items?: SaleItemBody[];
    };

    const storeId = body.store_id?.trim();
    const externalLocalId = body.external_local_id?.trim();
    if (!storeId || !externalLocalId) {
      return NextResponse.json(
        { success: false, error: "store_id et external_local_id requis." },
        { status: 400 }
      );
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const total = Number(body.total_amount ?? body.total ?? 0);
    const service = await createServiceSupabase();
    const result = await upsertSaleByExternalId(service, storeId, {
      total_amount: total,
      total,
      payment_method: body.payment_method || "cash",
      payment_status: body.payment_status || "completed",
      external_local_id: externalLocalId,
    });

    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    const items = body.items || [];
    if (items.length) {
      const itemsResult = await replaceSaleItems(
        service,
        result.id,
        items.map((i) => ({
          product_id: saleItemProductId(i.product_id ?? undefined),
          product_name: i.product_name || i.name || "Produit",
          quantity: Number(i.quantity ?? 1),
          unit_price: Number(i.unit_price ?? 0),
          subtotal: Number(i.subtotal ?? i.line_total ?? 0),
        }))
      );
      if ("error" in itemsResult) {
        return NextResponse.json({ success: false, error: itemsResult.error }, { status: 500 });
      }

      for (const i of items) {
        const productId = saleItemProductId(i.product_id ?? undefined);
        if (!productId) continue;
        const qty = Number(i.quantity ?? 1);
        const { data: product } = await service
          .from("products")
          .select("stock")
          .eq("id", productId)
          .eq("store_id", storeId)
          .maybeSingle();
        if (product) {
          await service
            .from("products")
            .update({ stock: Math.max(0, Number(product.stock) - qty) })
            .eq("id", productId);
        }
      }
    }

    return NextResponse.json({ success: true, id: result.id });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer la vente." },
      { status: 500 }
    );
  }
}

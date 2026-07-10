import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";

/**
 * Commande COD publique (paiement à la livraison).
 * Tente d'enregistrer dans product_orders si la migration 017 est appliquée,
 * sinon renvoie un message WhatsApp prêt à envoyer.
 */
export async function POST(request: Request) {
  let body: {
    storeId?: string;
    productId?: string;
    productName?: string;
    unitPrice?: number;
    customerName?: string;
    customerPhone?: string;
    address?: string;
    quantity?: number;
    storeName?: string;
    sellerPhone?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "JSON invalide" }, { status: 400 });
  }

  const customerName = body.customerName?.trim();
  const customerPhone = body.customerPhone?.trim();
  const address = body.address?.trim();
  const quantity = Math.max(1, Math.round(Number(body.quantity) || 1));
  const unitPrice = Math.max(0, Number(body.unitPrice) || 0);
  const productName = body.productName?.trim() || "Produit";
  const storeName = body.storeName?.trim() || "Boutique";

  if (!customerName || !customerPhone || !address) {
    return NextResponse.json(
      { success: false, error: "Nom, téléphone et adresse requis" },
      { status: 400 }
    );
  }

  const total = unitPrice * quantity;
  const whatsappMessage = [
    `Nouvelle commande COD — ${storeName}`,
    `Produit: ${productName}`,
    `Qté: ${quantity}`,
    `Total: ${total} FCFA`,
    `Client: ${customerName}`,
    `Tél: ${customerPhone}`,
    `Adresse: ${address}`,
    `Paiement: à la livraison`,
  ].join("\n");

  let orderId: string | null = null;
  let persisted = false;

  if (body.storeId && body.productId) {
    try {
      const supabase = await createServiceSupabase();
      const { data, error } = await supabase
        .from("product_orders")
        .insert({
          store_id: body.storeId,
          product_id: body.productId,
          customer_name: customerName,
          customer_phone: customerPhone,
          address,
          quantity,
          unit_price: unitPrice,
          total_amount: total,
          payment_method: "cash_on_delivery",
          status: "pending",
          locale: "fr",
        })
        .select("id")
        .maybeSingle();

      if (!error && data?.id) {
        orderId = data.id as string;
        persisted = true;
      }
    } catch {
      /* table may not exist yet */
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    orderId,
    whatsappMessage,
    sellerPhone: body.sellerPhone || null,
    total,
  });
}

/** Liste des commandes COD pour le commerçant (auth). */
export async function GET(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  const storeId =
    request.nextUrl.searchParams.get("storeId") ||
    request.nextUrl.searchParams.get("store_id");
  if (!storeId) {
    return NextResponse.json(
      { success: false, error: "storeId requis" },
      { status: 400 }
    );
  }

  const access = await checkStoreAccess(
    auth.serviceSupabase,
    auth.userId,
    storeId,
    "read"
  );
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status }
    );
  }

  const status = request.nextUrl.searchParams.get("status");
  const service = await createServiceSupabase();
  let query = service
    .from("product_orders")
    .select(
      "id, store_id, product_id, customer_name, customer_phone, address, quantity, unit_price, total_amount, payment_method, status, created_at, products(name)"
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error.message.includes("product_orders") || error.code === "42P01"
            ? "Table commandes absente — appliquez la migration 017."
            : error.message,
      },
      { status: 500 }
    );
  }

  const orders = (data || []).map((row) => {
    const product = row.products as { name?: string } | null;
    return {
      id: row.id as string,
      store_id: row.store_id as string,
      product_id: row.product_id as string,
      product_name: product?.name || "Produit",
      customer_name: row.customer_name as string,
      customer_phone: row.customer_phone as string,
      address: row.address as string,
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
      total_amount: Number(row.total_amount),
      payment_method: row.payment_method as string,
      status: row.status as string,
      created_at: row.created_at as string,
    };
  });

  return NextResponse.json({ success: true, orders });
}

const ALLOWED_STATUS = new Set([
  "pending",
  "confirmed",
  "delivered",
  "cancelled",
]);

/** Met à jour le statut d'une commande COD. */
export async function PATCH(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  let body: { id?: string; storeId?: string; status?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "JSON invalide" }, { status: 400 });
  }

  const id = body.id?.trim();
  const storeId = body.storeId?.trim();
  const status = body.status?.trim();
  if (!id || !storeId || !status || !ALLOWED_STATUS.has(status)) {
    return NextResponse.json(
      { success: false, error: "id, storeId et status valides requis" },
      { status: 400 }
    );
  }

  const access = await checkStoreAccess(
    auth.serviceSupabase,
    auth.userId,
    storeId,
    "write"
  );
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status }
    );
  }

  const service = await createServiceSupabase();
  const { data, error } = await service
    .from("product_orders")
    .update({ status })
    .eq("id", id)
    .eq("store_id", storeId)
    .select("id, status")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: error?.message || "Mise à jour impossible" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, order: data });
}

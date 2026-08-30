import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { isCloudUuid } from "@/lib/cloud-uuid";
import { createServiceSupabase } from "@/lib/supabase/server";
import { notifyStoreSubscribers } from "@/lib/push-server";

/**
 * Commande COD publique (paiement à la livraison).
 * Tente d'enregistrer dans product_orders si la migration 017 est appliquée,
 * sinon renvoie un message WhatsApp prêt à envoyer.
 */
const orderBuckets = new Map<string, { count: number; resetAt: number }>();

function allowPublicOrder(request: Request, max = 12, windowMs = 60 * 60 * 1000): boolean {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const key = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const bucket = orderBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    orderBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

function clip(value: string, max: number): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

export async function POST(request: Request) {
  if (!allowPublicOrder(request)) {
    return NextResponse.json(
      { success: false, error: "Trop de commandes. Réessayez plus tard." },
      { status: 429 }
    );
  }

  let body: {
    storeId?: string;
    productId?: string;
    customerName?: string;
    customerPhone?: string;
    address?: string;
    quantity?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "JSON invalide" }, { status: 400 });
  }

  const storeId = body.storeId?.trim() || "";
  const productId = body.productId?.trim() || "";
  const customerName = clip(body.customerName || "", 80);
  const customerPhone = clip(body.customerPhone || "", 24);
  const address = clip(body.address || "", 240);
  const quantity = Math.min(20, Math.max(1, Math.round(Number(body.quantity) || 1)));

  if (!customerName || !customerPhone || !address) {
    return NextResponse.json(
      { success: false, error: "Nom, téléphone et adresse requis" },
      { status: 400 }
    );
  }
  if (!isCloudUuid(storeId) || !isCloudUuid(productId)) {
    return NextResponse.json(
      { success: false, error: "Boutique ou produit invalide" },
      { status: 400 }
    );
  }

  const supabase = await createServiceSupabase();
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, phone, whatsapp, is_public")
    .eq("id", storeId)
    .eq("is_public", true)
    .maybeSingle();
  const { data: product } = await supabase
    .from("products")
    .select("id, store_id, name, price")
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (!store || !product) {
    return NextResponse.json(
      { success: false, error: "Boutique ou produit introuvable" },
      { status: 404 }
    );
  }

  const unitPrice = Math.max(0, Number(product.price) || 0);
  const productName = String(product.name || "Produit").slice(0, 120);
  const storeName = String(store.name || "Boutique").slice(0, 80);
  const sellerPhone = String(store.whatsapp || store.phone || "").replace(/\D/g, "").slice(0, 16);
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
  let pushSent = 0;

  try {
    const { data, error } = await supabase
      .from("product_orders")
      .insert({
        store_id: storeId,
        product_id: productId,
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
      pushSent = await notifyStoreSubscribers(supabase, storeId, {
        title: "Nouvelle commande COD",
        body: `${productName} ×${quantity} — ${customerName}`,
        url: "/products/orders",
      });
    }
  } catch {
    /* table may not exist yet */
  }

  return NextResponse.json({
    success: true,
    persisted,
    orderId,
    whatsappMessage,
    sellerPhone: sellerPhone || null,
    total,
    pushSent,
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

/** Met à jour le statut d'une commande COD (+ baisse stock à la confirmation). */
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

  const { data: existing, error: fetchError } = await service
    .from("product_orders")
    .select("id, status, product_id, quantity")
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json(
      { success: false, error: fetchError?.message || "Commande introuvable" },
      { status: 404 }
    );
  }

  const prevStatus = existing.status as string;
  const shouldDecrementStock =
    (status === "confirmed" || status === "delivered") &&
    prevStatus === "pending";

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

  let stockUpdated = false;
  if (shouldDecrementStock) {
    const productId = existing.product_id as string;
    const qty = Math.max(1, Number(existing.quantity) || 1);
    const { data: product } = await service
      .from("products")
      .select("id, stock, stock_quantity")
      .eq("id", productId)
      .eq("store_id", storeId)
      .maybeSingle();

    if (product) {
      const current = Number(
        (product as { stock?: number; stock_quantity?: number }).stock ??
          (product as { stock_quantity?: number }).stock_quantity ??
          0
      );
      const nextStock = Math.max(0, current - qty);
      const { error: stockError } = await service
        .from("products")
        .update({ stock: nextStock })
        .eq("id", productId)
        .eq("store_id", storeId);
      stockUpdated = !stockError;
    }
  }

  return NextResponse.json({
    success: true,
    order: data,
    stockUpdated,
  });
}

import { NextResponse } from "next/server";
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

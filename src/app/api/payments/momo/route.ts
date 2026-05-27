import { NextRequest, NextResponse } from "next/server";

/**
 * Simulates mobile money payment via PayDunya / CinetPay.
 * Set PAYMENT_API_KEY and PAYMENT_PROVIDER in .env for production.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, method, phone } = body as {
      amount: number;
      method: string;
      phone?: string;
    };

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
    }

    const provider = process.env.PAYMENT_PROVIDER || "paydunya";
    const apiKey = process.env.PAYMENT_API_KEY;
    const mode = process.env.PAYMENT_MODE || "test";

    // Test mode: simulate success after short delay logic
    if (mode === "test" || !apiKey) {
      const transactionId = `WAZO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return NextResponse.json({
        success: true,
        transaction_id: transactionId,
        provider,
        method,
        amount,
        phone: phone || null,
        message: "Paiement simulé avec succès",
      });
    }

    // Production: PayDunya checkout invoice (simplified)
    if (provider === "paydunya") {
      const res = await fetch("https://app.paydunya.com/api/v1/checkout-invoice/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PAYDUNYA-MASTER-KEY": apiKey,
          "PAYDUNYA-PRIVATE-KEY": process.env.PAYMENT_SECRET_KEY || "",
          "PAYDUNYA-TOKEN": process.env.PAYMENT_TOKEN || "",
        },
        body: JSON.stringify({
          invoice: {
            total_amount: amount,
            description: `Wazo Digital - ${method}`,
          },
          store: { name: "Wazo Digital" },
          actions: { callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/momo/callback` },
        }),
      });

      const data = await res.json();
      return NextResponse.json({
        success: res.ok,
        ...data,
      });
    }

    // CinetPay alternative
    if (provider === "cinetpay") {
      const res = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: apiKey,
          site_id: process.env.CINETPAY_SITE_ID,
          transaction_id: `WAZO-${Date.now()}`,
          amount,
          currency: "XOF",
          description: `Wazo - ${method}`,
          notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/momo/callback`,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/sales`,
          channels: "ALL",
        }),
      });
      const data = await res.json();
      return NextResponse.json({ success: data.code === "201", ...data });
    }

    return NextResponse.json({ success: false, error: "Unknown provider" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Payment error" },
      { status: 500 }
    );
  }
}

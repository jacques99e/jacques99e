import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { PROD_LANDING_URL } from "@/lib/site-urls";

export async function POST(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = {
    name: String(body.name || "").slice(0, 120),
    email: String(body.email || "").slice(0, 180),
    whatsapp: String(body.whatsapp || "").slice(0, 32),
    store: String(body.store || "").slice(0, 120),
    slug: String(body.slug || "").slice(0, 80),
    stage: String(body.stage || "store").slice(0, 40),
    utm: String(body.utm || "").slice(0, 160),
    plan: String(body.plan || "").slice(0, 20),
    note: String(body.note || "").slice(0, 200),
  };

  const base =
    process.env.NEXT_PUBLIC_LANDING_URL?.trim().replace(/\/$/, "") || PROD_LANDING_URL;
  const secret =
    process.env.SIGNUP_ALERT_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";

  const res = await fetch(`${base}/api/signup-alert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret
        ? { Authorization: `Bearer ${secret}`, "x-wazo-alert-secret": secret }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return NextResponse.json({ success: false }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}

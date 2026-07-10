import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook Meta WhatsApp Cloud API.
 * GET = vérification du challenge ; POST = messages entrants (ouvre la fenêtre 24 h).
 *
 * URL à enregistrer dans Meta Developer :
 *   https://app.wazo-digital.com/api/whatsapp/webhook
 * Verify token = WHATSAPP_VERIFY_TOKEN
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  // Accusé de réception immédiat (Meta exige < 20 s)
  console.info(
    "[whatsapp-webhook]",
    JSON.stringify(body).slice(0, 2000)
  );

  return NextResponse.json({ success: true });
}

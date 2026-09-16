import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { sendAuthOtpSms } from "@/lib/sms";

interface SendSmsHookPayload {
  user: { phone: string };
  sms: { otp: string };
}

function hookSecretCandidates(): string[] {
  const raw =
    process.env.SEND_SMS_HOOK_SECRET?.trim() ||
    process.env.SEND_SMS_HOOK_SECRETS?.trim();
  if (!raw) return [];

  const cleaned = raw.replace(/^["']|["']$/g, "").trim();
  const candidates = new Set<string>();

  if (/^v\d+,whsec_/.test(cleaned)) {
    candidates.add(cleaned.replace(/^v\d+,/, "")); // whsec_<base64> — format Supabase
    candidates.add(cleaned.replace(/^v\d+,whsec_/, "")); // <base64> seul
  }
  if (cleaned.startsWith("whsec_")) {
    candidates.add(cleaned.slice("whsec_".length));
  }
  candidates.add(cleaned);

  return [...candidates].filter(Boolean);
}

function verifyHookPayload(payload: string, headers: Record<string, string>): SendSmsHookPayload {
  const candidates = hookSecretCandidates();
  if (!candidates.length) {
    throw new Error("SEND_SMS_HOOK_SECRET manquant sur Vercel");
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const wh = new Webhook(candidate);
      return wh.verify(payload, headers) as SendSmsHookPayload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Signature hook invalide");
}

/** Diagnostic — n’expose plus la config interne. */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(request: Request) {
  if (process.env.SMS_AUTH_HOOK_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: {
          http_code: 410,
          message:
            "Auth SMS désactivée. Connexion via https://wazo-digital.com/login (email ou Google). Désactivez le hook Send SMS dans Supabase.",
        },
      },
      { status: 410 }
    );
  }

  const payload = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  try {
    const data = verifyHookPayload(payload, headers);
    const phone = data.user?.phone;
    const otp = data.sms?.otp;

    if (!phone || !otp) {
      return NextResponse.json(
        { error: { http_code: 400, message: "Payload hook invalide (phone ou otp manquant)" } },
        { status: 400 }
      );
    }

    const result = await sendAuthOtpSms(phone, otp);
    if (!result.ok) {
      console.error("[send-sms-hook]", phone, result.error);
      return NextResponse.json(
        { error: { http_code: 500, message: result.error ?? "Echec envoi SMS" } },
        { status: 500 }
      );
    }

    return new NextResponse("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Echec traitement hook SMS";
    const isVerifyError =
      message.includes("Missing required headers") ||
      message.includes("No matching signature") ||
      message.includes("Invalid signature") ||
      message.includes("timestamp");
    console.error("[send-sms-hook] verify/send", error);
    return NextResponse.json(
      {
        error: {
          http_code: 500,
          message: isVerifyError ? "Signature invalide." : "Echec traitement hook SMS",
        },
      },
      { status: 500 }
    );
  }
}

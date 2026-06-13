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

  if (cleaned.startsWith("v1,whsec_")) {
    candidates.add(cleaned.slice("v1,whsec_".length));
  }
  if (cleaned.startsWith("whsec_")) {
    candidates.add(cleaned.slice("whsec_".length));
  }
  candidates.add(cleaned);

  return [...candidates].filter(Boolean);
}

function hookSecret(): string | null {
  return hookSecretCandidates()[0] ?? null;
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

function smsConfigStatus() {
  const simulate = process.env.SMS_SIMULATE === "true";
  const provider = (process.env.SMS_PROVIDER || "twilio").toLowerCase();
  let providerConfigured = false;
  if (simulate) {
    providerConfigured = true;
  } else if (provider === "africastalking" || provider === "at") {
    providerConfigured = Boolean(process.env.AT_API_KEY && process.env.AT_USERNAME);
  } else if (provider === "vonage" || provider === "nexmo") {
    providerConfigured = Boolean(
      (process.env.VONAGE_API_KEY || process.env.NEXMO_API_KEY) &&
        (process.env.VONAGE_API_SECRET || process.env.NEXMO_API_SECRET) &&
        (process.env.VONAGE_FROM || process.env.NEXMO_FROM)
    );
  } else {
    providerConfigured = Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER
    );
  }
  return { simulate, provider, providerConfigured };
}

/** Diagnostic public — ne révèle aucun secret. */
export async function GET() {
  const secretConfigured = Boolean(hookSecret());
  const sms = smsConfigStatus();
  return NextResponse.json({
    ok: secretConfigured && (sms.simulate || sms.providerConfigured),
    hookSecretConfigured: secretConfigured,
    smsSimulate: sms.simulate,
    smsProvider: sms.provider,
    smsProviderConfigured: sms.providerConfigured,
  });
}

export async function POST(request: Request) {
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
          message: isVerifyError
            ? "Secret hook invalide : copiez le secret Supabase (Auth → Hooks → Send SMS) dans Vercel SEND_SMS_HOOK_SECRET (Production), puis redéployez."
            : message,
        },
      },
      { status: 500 }
    );
  }
}

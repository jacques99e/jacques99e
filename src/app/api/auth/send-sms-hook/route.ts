import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { sendAuthOtpSms } from "@/lib/sms";

interface SendSmsHookPayload {
  user: { phone: string };
  sms: { otp: string };
}

function hookSecret(): string | null {
  const raw = process.env.SEND_SMS_HOOK_SECRET?.trim();
  if (!raw) return null;
  return raw.replace(/^v1,whsec_/, "");
}

export async function POST(request: Request) {
  const secret = hookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: { http_code: 500, message: "SEND_SMS_HOOK_SECRET manquant sur Vercel" } },
      { status: 500 }
    );
  }

  const payload = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  try {
    const wh = new Webhook(secret);
    const data = wh.verify(payload, headers) as SendSmsHookPayload;
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
    console.error("[send-sms-hook] verify/send", error);
    return NextResponse.json(
      {
        error: {
          http_code: 500,
          message: error instanceof Error ? error.message : "Echec traitement hook SMS",
        },
      },
      { status: 500 }
    );
  }
}

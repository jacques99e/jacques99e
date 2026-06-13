import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const provider = (process.env.SMS_PROVIDER || "africastalking").toLowerCase();
  const simulate = process.env.SMS_SIMULATE === "true";

  let configured = false;
  if (simulate) {
    configured = true;
  } else if (provider === "africastalking" || provider === "at") {
    configured = Boolean(process.env.AT_API_KEY && process.env.AT_USERNAME);
  } else {
    configured = Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER
    );
  }

  return NextResponse.json({
    success: true,
    simulate,
    provider,
    configured,
  });
}

import { NextResponse } from "next/server";
import { getCeloEnvironmentLabel, getCeloMode, isCeloConfigured } from "@/lib/celo";
import { getPaymentMode, hasPaydunyaCredentials } from "@/lib/paydunya";
import { isPushConfigured } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** Endpoint public de monitoring (pas de secrets exposés). */
export async function GET() {
  const paymentMode = getPaymentMode();
  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  // Flags booléens uniquement (monitoring) — pas de noms de modèles / détails internes
  return NextResponse.json({
    ok: true,
    service: "wazo-digital",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    payment: {
      mode: paymentMode,
      configured: hasPaydunyaCredentials(),
    },
    supabase: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    crons: Boolean(process.env.CRON_SECRET?.trim()),
    email: resendConfigured,
    assistant: process.env.ASSISTANT_SIMULATE !== "true",
    push: isPushConfigured(),
    celo: {
      mode: getCeloMode(),
      environment: getCeloEnvironmentLabel(),
      configured: isCeloConfigured(),
    },
  });
}

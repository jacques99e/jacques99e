import { NextResponse } from "next/server";
import { getCeloEnvironmentLabel, getCeloMode, isCeloConfigured } from "@/lib/celo";
import { getPaymentMode, hasPaydunyaCredentials } from "@/lib/paydunya";

export const dynamic = "force-dynamic";

/** Endpoint public de monitoring (pas de secrets exposés). */
export async function GET() {
  const paymentMode = getPaymentMode();
  return NextResponse.json({
    ok: true,
    service: "wazo-digital",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    payment: {
      mode: paymentMode,
      paydunyaConfigured: hasPaydunyaCredentials(),
    },
    supabase: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    celo: {
      mode: getCeloMode(),
      environment: getCeloEnvironmentLabel(),
      configured: isCeloConfigured(),
    },
  });
}

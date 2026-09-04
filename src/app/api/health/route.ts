import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public liveness only — no config fingerprint. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

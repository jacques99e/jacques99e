import { NextRequest, NextResponse } from "next/server";
import tipsData from "@/data/agriculture-tips.json";
import { requireAuthContext } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const region = request.nextUrl.searchParams.get("region") || "west_africa";
  const crop = request.nextUrl.searchParams.get("crop") || "general";
  const data = tipsData as Record<string, Record<string, string[]>>;
  const tips = data[region]?.[crop] || data[region]?.general || data.default.general;
  return NextResponse.json({ region, crop, tips });
}

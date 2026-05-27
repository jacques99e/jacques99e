import { NextRequest, NextResponse } from "next/server";
import tipsData from "@/data/agriculture-tips.json";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") || "west_africa";
  const crop = request.nextUrl.searchParams.get("crop") || "general";
  const data = tipsData as Record<string, Record<string, string[]>>;
  const tips = data[region]?.[crop] || data[region]?.general || data.default.general;
  return NextResponse.json({ region, crop, tips });
}

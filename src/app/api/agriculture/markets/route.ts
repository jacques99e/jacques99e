import { NextRequest, NextResponse } from "next/server";
import {
  fetchLocalizedMarketPrices,
  parseMarketCoordinates,
} from "@/lib/agriculture-markets-geo";
import { isMarketRegionId } from "@/lib/agriculture-markets-regions";
import { requireAuthContext } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");
  const regionParam = request.nextUrl.searchParams.get("region");
  const coords = parseMarketCoordinates(latParam, lonParam);
  const regionOverride =
    regionParam && isMarketRegionId(regionParam) ? regionParam : undefined;

  try {
    const data = await fetchLocalizedMarketPrices({
      lat: coords?.lat,
      lon: coords?.lon,
      fromGps: Boolean(coords),
      regionOverride,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Prix marchés indisponibles";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}

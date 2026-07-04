import { NextRequest, NextResponse } from "next/server";
import {
  fetchAgricultureWeather,
  resolveWeatherCoordinates,
  withLocationHint,
} from "@/lib/agriculture-weather";
import { requireAuthContext } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");
  const { lat, lon, fromGps } = resolveWeatherCoordinates(latParam, lonParam);

  try {
    const weather = withLocationHint(
      await fetchAgricultureWeather(lat, lon, {
        openWeatherApiKey: process.env.OPENWEATHER_API_KEY,
      }),
      fromGps
    );

    return NextResponse.json({
      success: true,
      ...weather,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Météo indisponible";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}

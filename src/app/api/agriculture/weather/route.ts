import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (apiKey && lat && lon) {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fr`
      );
      const data = await res.json();
      return NextResponse.json({
        temp_c: Math.round(data.main?.temp ?? 28),
        condition: data.weather?.[0]?.description ?? "—",
        humidity: data.main?.humidity ?? 60,
        alert: null,
        source: "openweathermap",
      });
    } catch {
      /* mock fallback */
    }
  }

  return NextResponse.json({
    temp_c: 29,
    condition: "Partiellement nuageux",
    humidity: 62,
    alert: "Simulation météo — configurez OPENWEATHER_API_KEY pour données réelles.",
    source: "mock",
  });
}

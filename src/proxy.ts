import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { allowIp } from "@/lib/rate-limit";
import { allowPublicApi, isAllowedOrigin, isWebhookPath } from "@/lib/request-origin";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();

  if (pathname.startsWith("/api")) {
    const mutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    if (mutating && !isWebhookPath(pathname) && !isAllowedOrigin(request)) {
      return NextResponse.json(
        { success: false, error: "Origine non autorisée." },
        { status: 403 }
      );
    }
    const limit = allowPublicApi(pathname, method);
    if (limit && !allowIp(request, limit.scope, limit.max, limit.windowMs)) {
      return NextResponse.json(
        { success: false, error: "Trop de requêtes. Réessayez plus tard." },
        { status: 429 }
      );
    }
    return response;
  }

  const publicPaths = ["/", "/login", "/register", "/auth/receive"];

  // Avoid blocking public/auth handoff routes on external auth network hiccups.
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return response;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("auth timeout")), 2500)
      ),
    ]);
  } catch {
    // Ignore auth proxy failures in local test mode.
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|boutique|formation|suivi|trace).*)",
  ],
};

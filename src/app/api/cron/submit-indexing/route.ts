import { NextResponse } from "next/server";
import { runIndexingForAllSites } from "@/lib/indexing";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Cron quotidien : soumet les sitemaps landing + app a IndexNow et Bing (sans Search Console manuel). */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const results = await runIndexingForAllSites();
  const ok = results.every((r) => !("error" in r));

  return NextResponse.json({
    success: ok,
    results,
    note: "Indexation automatique IndexNow + ping Bing. Google decouvre le sitemap via robots.txt.",
  });
}

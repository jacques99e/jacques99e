import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runIndexingForAllSites } from "@/lib/indexing";

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

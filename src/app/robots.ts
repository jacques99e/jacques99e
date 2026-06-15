import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/seo";

const PRIVATE_PREFIXES = [
  "/api/",
  "/auth/",
  "/login",
  "/register",
  "/setup",
  "/dashboard",
  "/products",
  "/clients",
  "/billing",
  "/settings",
  "/analytics",
  "/messages",
  "/help",
  "/insights",
  "/modules",
  "/profile",
  "/sales",
  "/education",
  "/health",
  "/logistics",
  "/agriculture",
  "/blockchain",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/boutique/", "/formation", "/suivi", "/trace"],
      disallow: ["/", ...PRIVATE_PREFIXES],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}

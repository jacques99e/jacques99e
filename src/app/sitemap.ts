import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/seo";
import { createServiceSupabase } from "@/lib/supabase/server";

const STATIC_PUBLIC_PAGES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/formation", changeFrequency: "monthly", priority: 0.7 },
  { path: "/suivi", changeFrequency: "monthly", priority: 0.7 },
  { path: "/trace", changeFrequency: "monthly", priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_PUBLIC_PAGES.map(
    ({ path, changeFrequency, priority }) => ({
      url: `${APP_URL}${path}`,
      lastModified,
      changeFrequency,
      priority,
    })
  );

  let storeEntries: MetadataRoute.Sitemap = [];
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createServiceSupabase();
    const { data: stores } = await supabase
      .from("stores")
      .select("id, slug, updated_at")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(500);

    storeEntries = (stores ?? []).map((store) => ({
      url: `${APP_URL}/boutique/${encodeURIComponent(store.slug)}`,
      lastModified: store.updated_at ? new Date(store.updated_at) : lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const storeIds = (stores ?? []).map((s) => s.id as string);
    if (storeIds.length) {
      const { data: products } = await supabase
        .from("products")
        .select("id, created_at, store_id, stores!inner(slug)")
        .in("store_id", storeIds)
        .order("created_at", { ascending: false })
        .limit(2000);

      const slugByStoreId = new Map(
        (stores ?? []).map((s) => [s.id as string, s.slug as string])
      );

      productEntries = (products ?? [])
        .map((product) => {
          const storeSlug =
            (product.stores as { slug?: string } | null)?.slug ??
            slugByStoreId.get(product.store_id as string);
          if (!storeSlug) return null;
          return {
            url: `${APP_URL}/boutique/${encodeURIComponent(storeSlug)}/produit/${product.id}`,
            lastModified: product.created_at
              ? new Date(product.created_at as string)
              : lastModified,
            changeFrequency: "weekly" as const,
            priority: 0.6,
          };
        })
        .filter((entry) => entry !== null) as MetadataRoute.Sitemap;
    }
  } catch {
    // Sitemap statique si Supabase indisponible au build
  }

  return [...staticEntries, ...storeEntries, ...productEntries];
}

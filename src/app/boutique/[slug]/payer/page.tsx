import type { Metadata } from "next";
import { createServiceSupabase } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/seo";
import { isCloudUuid } from "@/lib/cloud-uuid";
import { rowToProduct } from "@/lib/product-db-map";
import { toPublicProductImageUrl } from "@/lib/storage-public-url";
import { isSafeStoreSlug } from "@/lib/utils";
import { StorefrontNotFound } from "../StorefrontNotFound";
import { PayClient } from "./PayClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ product?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isSafeStoreSlug(slug)) {
    return { title: "Payer — Wazo Digital", robots: { index: false, follow: false } };
  }
  const supabase = await createServiceSupabase();
  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  return {
    title: store ? `Payer — ${store.name}` : "Payer — Wazo Digital",
    description: "Payez en Mobile Money, sans installer d’application.",
    alternates: store ? { canonical: `/boutique/${slug}/payer` } : undefined,
    robots: store ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: store ? `Payer — ${store.name}` : "Payer",
      url: `${APP_URL}/boutique/${slug}/payer`,
      type: "website",
    },
  };
}

export default async function BoutiquePayPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { product: productParam } = await searchParams;
  if (!isSafeStoreSlug(slug)) {
    return <StorefrontNotFound />;
  }

  const supabase = await createServiceSupabase();
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, slug, logo_url, is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!store) {
    return <StorefrontNotFound />;
  }

  const { data: productRows } = await supabase
    .from("products")
    .select("id, store_id, name, description, price, stock, photo_url, created_at")
    .eq("store_id", store.id)
    .order("name");

  const products = (productRows || [])
    .map((row) => rowToProduct(row as Record<string, unknown>))
    .filter((p) => p.stock_quantity > 0 && p.price >= 200);

  const requestedId = productParam?.trim() || "";
  const selected =
    (isCloudUuid(requestedId) && products.find((p) => p.id === requestedId)) ||
    (products.length === 1 ? products[0] : null);

  return (
    <PayClient
      store={{
        id: store.id,
        name: store.name,
        slug: store.slug,
        logo_url: toPublicProductImageUrl(store.logo_url),
      }}
      products={products}
      selectedProduct={selected}
    />
  );
}

import type { Metadata } from "next";
import { createServiceSupabase } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/seo";
import { resolveContactPhone } from "@/lib/contact-phone";
import { PRODUCT_DB_COLUMNS, rowToProduct } from "@/lib/product-db-map";
import { toPublicProductImageUrl } from "@/lib/storage-public-url";
import { isSafeStoreSlug } from "@/lib/utils";
import { StorefrontClient } from "./StorefrontClient";
import { StorefrontNotFound } from "./StorefrontNotFound";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isSafeStoreSlug(slug)) {
    return { title: "Boutique — Wazo Digital", robots: { index: false, follow: false } };
  }
  const supabase = await createServiceSupabase();
  const { data: store } = await supabase
    .from("stores")
    .select("name, description")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  return {
    title: store ? `${store.name} — Wazo Digital` : "Boutique — Wazo Digital",
    description: store?.description || "Catalogue en ligne sur Wazo Digital",
    alternates: store ? { canonical: `/boutique/${slug}` } : undefined,
    robots: store ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: store?.name || "Boutique",
      description: store?.description || "Catalogue en ligne",
      url: `${APP_URL}/boutique/${slug}`,
      type: "website",
      siteName: "Wazo Digital",
    },
  };
}

export default async function StorefrontPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isSafeStoreSlug(slug)) {
    return <StorefrontNotFound />;
  }
  const supabase = await createServiceSupabase();

  const { data: store } = await supabase
    .from("stores")
    .select("id, owner_id, name, slug, description, phone, whatsapp, logo_url, cover_url, is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!store) {
    return <StorefrontNotFound />;
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", store.owner_id)
    .maybeSingle();

  const { data: products } = await supabase
    .from("products")
    .select(PRODUCT_DB_COLUMNS)
    .eq("store_id", store.id)
    .order("name");

  const contactPhone = resolveContactPhone(
    store.whatsapp,
    store.phone,
    ownerProfile?.phone
  );

  return (
    <StorefrontClient
      store={{
        id: store.id,
        owner_id: "",
        name: store.name,
        slug: store.slug,
        description: store.description,
        phone: store.phone,
        whatsapp: store.whatsapp,
        logo_url: toPublicProductImageUrl(store.logo_url),
        cover_url: toPublicProductImageUrl(store.cover_url),
        is_public: true,
        products: (products || []).map((p) =>
          rowToProduct(p as Record<string, unknown>)
        ),
      }}
      contactPhone={contactPhone}
    />
  );
}

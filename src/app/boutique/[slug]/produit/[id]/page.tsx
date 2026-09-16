import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabase/server";
import { APP_URL, openGraphShareImages } from "@/lib/seo";
import { resolveContactPhone } from "@/lib/contact-phone";
import { PRODUCT_DB_COLUMNS, rowToProduct } from "@/lib/product-db-map";
import { toPublicProductImageUrl } from "@/lib/storage-public-url";
import { isCloudUuid } from "@/lib/cloud-uuid";
import { isSafeStoreSlug } from "@/lib/utils";
import { ProductDetailClient } from "./ProductDetailClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, id } = await params;
  if (!isSafeStoreSlug(slug) || !isCloudUuid(id)) {
    return { title: "Produit — Wazo Digital", robots: { index: false, follow: false } };
  }
  const supabase = await createServiceSupabase();

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, logo_url, cover_url")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!store) {
    return { title: "Produit — Wazo Digital", robots: { index: false, follow: false } };
  }

  const { data: product } = await supabase
    .from("products")
    .select("name, description, photo_url, price")
    .eq("id", id)
    .eq("store_id", store.id)
    .single();

  if (!product) {
    return { title: "Produit — Wazo Digital", robots: { index: false, follow: false } };
  }

  const price = Number(product.price);
  const priceLabel =
    Number.isFinite(price) && price > 0
      ? ` — ${Math.round(price).toLocaleString("fr-FR")} FCFA`
      : "";
  const imageUrl =
    toPublicProductImageUrl(product.photo_url as string | null) ||
    toPublicProductImageUrl(store.cover_url) ||
    toPublicProductImageUrl(store.logo_url);
  const description =
    product.description || `Commandez ${product.name} chez ${store.name}${priceLabel}`;
  const images = openGraphShareImages(imageUrl, product.name);
  const ogTitle = `${product.name}${priceLabel}`;

  return {
    title: `${product.name} — ${store.name}`,
    description,
    alternates: { canonical: `/boutique/${slug}/produit/${id}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: ogTitle,
      description: product.description || `Produit de ${store.name}`,
      url: `${APP_URL}/boutique/${slug}/produit/${id}`,
      type: "website",
      siteName: store.name,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: images.map((img) => img.url),
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  if (!isSafeStoreSlug(slug) || !isCloudUuid(id)) {
    notFound();
  }
  const supabase = await createServiceSupabase();

  const { data: store } = await supabase
    .from("stores")
    .select("id, owner_id, name, slug, phone, whatsapp, logo_url")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!store) {
    notFound();
  }

  const { data: productRow } = await supabase
    .from("products")
    .select(PRODUCT_DB_COLUMNS)
    .eq("id", id)
    .eq("store_id", store.id)
    .single();

  if (!productRow) {
    notFound();
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", store.owner_id)
    .maybeSingle();

  const contactPhone = resolveContactPhone(
    store.whatsapp,
    store.phone,
    ownerProfile?.phone
  );

  const product = rowToProduct(productRow as Record<string, unknown>);
  const rawLanding = (productRow as { landing_content?: unknown }).landing_content;
  const landing =
    rawLanding && typeof rawLanding === "object"
      ? (rawLanding as {
          headline?: string;
          subheadline?: string;
          bullets?: string[];
          cta?: string;
          whatsappPitch?: string;
          deliveryNote?: string;
        })
      : null;

  return (
    <ProductDetailClient
      store={{
        id: store.id,
        name: store.name,
        slug: store.slug,
        logo_url: toPublicProductImageUrl(store.logo_url),
      }}
      product={product}
      contactPhone={contactPhone}
      landing={
        landing?.headline
          ? {
              headline: String(landing.headline),
              subheadline: String(landing.subheadline || product.description || ""),
              bullets: Array.isArray(landing.bullets)
                ? landing.bullets.map(String)
                : [],
              cta: String(landing.cta || "Commander"),
              whatsappPitch: String(landing.whatsappPitch || ""),
              deliveryNote: String(landing.deliveryNote || ""),
            }
          : null
      }
    />
  );
}

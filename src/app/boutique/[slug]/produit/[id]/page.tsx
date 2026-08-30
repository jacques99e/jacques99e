import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/seo";
import { resolveContactPhone } from "@/lib/contact-phone";
import { rowToProduct } from "@/lib/product-db-map";
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
    .select("id, name")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!store) {
    return { title: "Produit — Wazo Digital", robots: { index: false, follow: false } };
  }

  const { data: product } = await supabase
    .from("products")
    .select("name, description, image_url, photo_url")
    .eq("id", id)
    .eq("store_id", store.id)
    .single();

  if (!product) {
    return { title: "Produit — Wazo Digital", robots: { index: false, follow: false } };
  }

  const imageUrl = toPublicProductImageUrl(
    (product.image_url as string | null) ?? (product.photo_url as string | null)
  );

  return {
    title: `${product.name} — ${store.name}`,
    description: product.description || `Découvrez ${product.name} sur ${store.name}`,
    alternates: { canonical: `/boutique/${slug}/produit/${id}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: product.name,
      description: product.description || `Produit de ${store.name}`,
      url: `${APP_URL}/boutique/${slug}/produit/${id}`,
      type: "website",
      siteName: store.name,
      images: imageUrl ? [{ url: imageUrl, alt: product.name }] : undefined,
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
    .select("id, store_id, name, description, price, stock, stock_quantity, barcode, photo_url, image_url, is_active, created_at, landing_content")
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

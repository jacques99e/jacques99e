import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/seo";
import { resolveContactPhone } from "@/lib/contact-phone";
import { rowToProduct } from "@/lib/product-db-map";
import { toPublicProductImageUrl } from "@/lib/storage-public-url";
import { ProductDetailClient } from "./ProductDetailClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, id } = await params;
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
  const supabase = await createServiceSupabase();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!store) {
    notFound();
  }

  const { data: productRow } = await supabase
    .from("products")
    .select("*")
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
    />
  );
}

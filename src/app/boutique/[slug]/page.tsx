import type { Metadata } from "next";
import { createServiceSupabase } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/seo";
import { StorefrontClient } from "./StorefrontClient";
import { StorefrontNotFound } from "./StorefrontNotFound";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServiceSupabase();
  const { data: store } = await supabase
    .from("stores")
    .select("name, description")
    .eq("slug", slug)
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
  const supabase = await createServiceSupabase();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!store) {
    return <StorefrontNotFound />;
  }

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .order("name");

  return (
    <StorefrontClient
      store={{
        ...store,
        products: (products || []).map((p) => ({
          ...p,
          price: Number(p.price),
        })),
      }}
    />
  );
}

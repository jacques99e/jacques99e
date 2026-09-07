import type { Metadata } from "next";
import { createServiceSupabase } from "@/lib/supabase/server";
import { isSafeStoreSlug } from "@/lib/utils";
import { StorefrontNotFound } from "../StorefrontNotFound";
import { PaymentReturnClient } from "./PaymentReturnClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tx?: string; status?: string }>;
}

export const metadata: Metadata = {
  title: "Paiement — Wazo Digital",
  robots: { index: false, follow: false },
};

export default async function BoutiquePaymentReturnPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { tx, status } = await searchParams;
  if (!isSafeStoreSlug(slug)) {
    return <StorefrontNotFound />;
  }

  const supabase = await createServiceSupabase();
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!store) {
    return <StorefrontNotFound />;
  }

  return (
    <PaymentReturnClient
      slug={store.slug}
      storeName={store.name}
      tx={tx?.trim() || ""}
      cancelled={status === "cancelled"}
    />
  );
}

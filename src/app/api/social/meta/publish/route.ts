import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import {
  appPublicUrl,
  publishInstagramPhoto,
  publishPageFeed,
  publishPagePhoto,
} from "@/lib/merchant-meta";
import { PRODUCT_DB_COLUMNS, rowToProduct } from "@/lib/product-db-map";
import { toPublicProductImageUrl } from "@/lib/storage-public-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PublishBody = {
  storeId?: string;
  /** boutique | product */
  kind?: "boutique" | "product";
  productId?: string;
  /** URL publique à coller dans la légende (boutique, produit ou paiement). */
  link?: string;
  platforms?: Array<"facebook" | "instagram">;
};

function isAllowedShareLink(link: string, appUrl: string) {
  try {
    const parsed = new URL(link);
    const allowed = new URL(appUrl);
    return parsed.origin === allowed.origin && parsed.pathname.startsWith("/boutique/");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as PublishBody;
  const storeId = body.storeId?.trim();
  const kind = body.kind || "boutique";
  const platforms = body.platforms?.length ? body.platforms : ["facebook"];

  if (!storeId) {
    return NextResponse.json({ success: false, error: "storeId requis" }, { status: 400 });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status || 403 }
    );
  }

  const service = await createServiceSupabase();
  const [{ data: store }, { data: social }] = await Promise.all([
    service.from("stores").select("id, name, slug, logo_url, cover_url").eq("id", storeId).maybeSingle(),
    service
      .from("store_social_accounts")
      .select("page_id, page_access_token, ig_user_id")
      .eq("store_id", storeId)
      .eq("platform", "facebook")
      .maybeSingle(),
  ]);

  if (!store) {
    return NextResponse.json({ success: false, error: "Boutique introuvable" }, { status: 404 });
  }
  if (!social?.page_id || !social.page_access_token) {
    return NextResponse.json(
      {
        success: false,
        error: "Facebook non connecté. Allez dans Paramètres métier → Réseaux sociaux.",
      },
      { status: 400 }
    );
  }

  const appUrl = appPublicUrl();
  const landingUrl =
    process.env.NEXT_PUBLIC_LANDING_URL?.trim().replace(/\/$/, "") || "https://wazo-digital.com";
  let link = store.slug ? `${appUrl}/boutique/${store.slug}` : appUrl;
  let imageUrl =
    toPublicProductImageUrl(store.cover_url) ||
    toPublicProductImageUrl(store.logo_url) ||
    `${landingUrl}/social-card.png`;
  let message = [
    `Découvrez ${store.name} sur Wazo Digital`,
    "",
    "Catalogue + commande WhatsApp",
    "",
    link,
  ].join("\n");

  if (kind === "product") {
    if (!body.productId) {
      return NextResponse.json({ success: false, error: "productId requis" }, { status: 400 });
    }
    const { data: productRow } = await service
      .from("products")
      .select(PRODUCT_DB_COLUMNS)
      .eq("id", body.productId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!productRow) {
      return NextResponse.json({ success: false, error: "Produit introuvable" }, { status: 404 });
    }
    const product = rowToProduct(productRow as Record<string, unknown>);
    if (store.slug) {
      link = `${appUrl}/boutique/${store.slug}/produit/${product.id}`;
    }
    const price = product.price ? `${product.price.toLocaleString("fr-FR")} FCFA` : "";
    message = [
      `${product.name}${price ? ` — ${price}` : ""}`,
      "",
      product.description ? String(product.description).slice(0, 280) : "",
      "",
      `Commandez chez ${store.name} :`,
      link,
    ]
      .filter(Boolean)
      .join("\n");
    imageUrl = product.image_url || imageUrl;
  }

  if (body.link && isAllowedShareLink(body.link, appUrl) && body.link !== link) {
    message = message.split(link).join(body.link);
    link = body.link;
    const productIdFromLink = new URL(link).searchParams.get("product");
    if (kind !== "product" && productIdFromLink) {
      const { data: payProductRow } = await service
        .from("products")
        .select(PRODUCT_DB_COLUMNS)
        .eq("id", productIdFromLink)
        .eq("store_id", storeId)
        .maybeSingle();
      if (payProductRow) {
        const payProduct = rowToProduct(payProductRow as Record<string, unknown>);
        imageUrl = payProduct.image_url || imageUrl;
      }
    }
  }

  const results: Record<string, { ok: boolean; id?: string; error?: string }> = {};

  if (platforms.includes("facebook")) {
    try {
      const fb =
        imageUrl && /^https:\/\//i.test(imageUrl)
          ? await publishPagePhoto({
              pageId: social.page_id,
              pageAccessToken: social.page_access_token,
              imageUrl,
              caption: message,
            }).catch(() =>
              publishPageFeed({
                pageId: social.page_id,
                pageAccessToken: social.page_access_token,
                message,
                link,
              })
            )
          : await publishPageFeed({
              pageId: social.page_id,
              pageAccessToken: social.page_access_token,
              message,
              link,
            });
      results.facebook = { ok: true, id: fb.id };
    } catch (e) {
      results.facebook = {
        ok: false,
        error: e instanceof Error ? e.message : "Erreur Facebook",
      };
    }
  }

  if (platforms.includes("instagram")) {
    if (!social.ig_user_id) {
      results.instagram = {
        ok: false,
        error: "Instagram Pro non lié à votre Page Facebook.",
      };
    } else if (!imageUrl) {
      results.instagram = { ok: false, error: "Une image est requise pour Instagram." };
    } else {
      try {
        const ig = await publishInstagramPhoto({
          igUserId: social.ig_user_id,
          pageAccessToken: social.page_access_token,
          imageUrl,
          caption: message,
        });
        results.instagram = { ok: true, id: ig.id };
      } catch (e) {
        results.instagram = {
          ok: false,
          error: e instanceof Error ? e.message : "Erreur Instagram",
        };
      }
    }
  }

  const ok = Object.values(results).some((r) => r.ok);
  return NextResponse.json({ success: ok, results }, { status: ok ? 200 : 400 });
}

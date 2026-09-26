import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { generateProductLanding } from "@/lib/assistant-product-landing";
import { allowUser } from "@/lib/rate-limit";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  if (!(await allowUser(auth.userId, "assistant", 25, 60 * 60 * 1000))) {
    return NextResponse.json(
      { success: false, error: "Trop de requêtes IA. Réessayez plus tard." },
      { status: 429 }
    );
  }

  let body: {
    name?: string;
    description?: string | null;
    price?: number;
    storeName?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON invalide" },
      { status: 400 }
    );
  }

  const name = body.name?.trim();
  const storeName = body.storeName?.trim() || "Wazo Digital";
  if (!name) {
    return NextResponse.json(
      { success: false, error: "Nom produit requis" },
      { status: 400 }
    );
  }

  const result = await generateProductLanding({
    name,
    description: body.description,
    price: Number(body.price) || 0,
    storeName,
  });

  return NextResponse.json({
    success: true,
    content: result.content,
    source: result.source,
    ...(result.error ? { warning: result.error } : {}),
  });
}

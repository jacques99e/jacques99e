import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import {
  parseSaleWithAi,
  type CatalogProduct,
} from "@/lib/assistant-parse-sale";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  let body: {
    transcript?: string;
    products?: CatalogProduct[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON invalide" },
      { status: 400 }
    );
  }

  const transcript = body.transcript?.trim();
  if (!transcript) {
    return NextResponse.json(
      { success: false, error: "Dictée vide" },
      { status: 400 }
    );
  }

  const products = Array.isArray(body.products)
    ? body.products
        .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
        .map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          stock: Number(p.stock) || 0,
        }))
        .slice(0, 60)
    : [];

  const result = await parseSaleWithAi(transcript, products);
  return NextResponse.json({ success: true, ...result });
}

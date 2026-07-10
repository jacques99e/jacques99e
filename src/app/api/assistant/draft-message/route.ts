import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import {
  generateDraftMessage,
  type DraftMessageType,
} from "@/lib/assistant-draft";

const ALLOWED_TYPES = new Set<DraftMessageType>([
  "relance_client",
  "promo",
  "credit_reminder",
  "share_catalog",
  "celebrate_growth",
]);

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  let body: {
    type?: string;
    storeName?: string;
    clientName?: string;
    productName?: string;
    context?: string;
    boutiqueUrl?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON invalide" },
      { status: 400 }
    );
  }

  const type = body.type as DraftMessageType | undefined;
  const storeName = body.storeName?.trim();
  if (!type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      { success: false, error: "type de message invalide" },
      { status: 400 }
    );
  }
  if (!storeName) {
    return NextResponse.json(
      { success: false, error: "storeName requis" },
      { status: 400 }
    );
  }

  const result = await generateDraftMessage({
    type,
    storeName,
    clientName: body.clientName?.trim(),
    productName: body.productName?.trim(),
    context: body.context?.trim(),
    boutiqueUrl: body.boutiqueUrl?.trim(),
  });

  return NextResponse.json({
    success: true,
    message: result.message,
    source: result.source,
    ...(result.error ? { warning: result.error } : {}),
  });
}

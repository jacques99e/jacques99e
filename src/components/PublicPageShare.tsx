"use client";

import { Facebook, MessageCircle } from "lucide-react";
import { buildFacebookShareHref } from "@/lib/facebook-share";
import { openWhatsAppShare } from "@/lib/whatsapp-share";
import { appendShareUrl } from "@/lib/bring-clients";

type Props = {
  url: string;
  text: string;
  className?: string;
};

export function PublicPageShare({ url, text, className }: Props) {
  if (!url) return null;
  const waText = appendShareUrl(text, url);
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#075E54]/70">
        Partager
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openWhatsAppShare(waText)}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </button>
        <a
          href={buildFacebookShareHref(url)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1877F2] px-4 text-sm font-semibold text-white"
        >
          <Facebook className="h-4 w-4" />
          Facebook
        </a>
      </div>
    </div>
  );
}

"use client";

import { Facebook, MessageCircle } from "lucide-react";
import { buildFacebookShareUrl } from "@/lib/facebook-share";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";

type Props = {
  url: string;
  text: string;
  className?: string;
};

export function PublicPageShare({ url, text, className }: Props) {
  if (!url) return null;
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#075E54]/70">
        Partager
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={buildWhatsAppShareUrl(`${text}\n${url}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
        <a
          href={buildFacebookShareUrl(url, text)}
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

"use client";

import { Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { buildFacebookShareHref } from "@/lib/facebook-share";
import { isStandaloneDisplay } from "@/lib/open-share";
import { cn } from "@/lib/utils";

type Props = {
  url: string;
  quote?: string;
  storeId?: string | null;
  kind?: "boutique" | "product";
  productId?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  size?: "default" | "sm";
  onShared?: () => void;
};

export function ShareFacebookButton({
  url,
  storeId,
  kind = "boutique",
  productId,
  label = "Facebook",
  className,
  buttonClassName,
  size = "default",
  onShared,
}: Props) {
  if (!url) return null;
  const href = buildFacebookShareHref(url);
  const stayInPlace =
    isStandaloneDisplay() ||
    (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent));
  const target = stayInPlace ? "_self" : "_blank";

  const onClick = () => {
    onShared?.();
    if (!storeId) return;
    void apiFetch("/api/social/meta/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        kind,
        productId,
        link: url,
        platforms: ["facebook"],
      }),
    }).catch(() => {
      /* Le lien Facebook est déjà ouvert. */
    });
  };

  return (
    <div className={className}>
      <Button asChild variant="outline" size={size} className={cn("border-[#1877F2]/40 text-[#1877F2]", buttonClassName)}>
        <a href={href} target={target} rel="noopener noreferrer" onClick={onClick}>
          <Facebook className="h-3.5 w-3.5" />
          {label}
        </a>
      </Button>
    </div>
  );
}

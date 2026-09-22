"use client";

import { Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { openFacebookShare } from "@/lib/facebook-share";
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
  quote,
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

  const onClick = () => {
    openFacebookShare(url, quote);
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
      /* Le sharer Facebook est déjà ouvert. */
    });
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={cn("border-[#1877F2]/40 text-[#1877F2]", buttonClassName)}
        onClick={onClick}
      >
        <Facebook className="h-3.5 w-3.5" />
        {label}
      </Button>
    </div>
  );
}

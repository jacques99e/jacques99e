"use client";

import { useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const share = async () => {
    if (!url) return;
    openFacebookShare(url, quote);
    onShared?.();
    if (!storeId) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await apiFetch("/api/social/meta/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          kind,
          productId,
          link: url,
          platforms: ["facebook"],
        }),
      });
      const data = (await res.json()) as { success?: boolean };
      if (res.ok && data.success) {
        setMsg("Aussi publié sur votre Page Facebook ✓");
      }
    } catch {
      /* Le sharer Facebook est déjà ouvert. */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={cn("border-[#1877F2]/40 text-[#1877F2]", buttonClassName)}
        disabled={busy || !url}
        onClick={() => void share()}
      >
        <Facebook className="h-3.5 w-3.5" />
        {busy ? "Publication…" : label}
      </Button>
      {msg ? <p className="mt-1 text-[11px] text-[#1877F2]">{msg}</p> : null}
    </div>
  );
}

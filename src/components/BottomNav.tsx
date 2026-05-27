"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, ShoppingBag, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const links = [
    { href: "/dashboard", icon: Home, label: "Accueil" },
    { href: "/products", icon: Package, label: "Produits" },
    { href: "/sales", icon: ShoppingBag, label: "Ventes" },
    { href: "/messages", icon: MessageCircle, label: "Messages" },
    { href: "/profile", icon: User, label: "Profil" },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#075E54]/20 bg-[#075E54] safe-bottom">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-white" : "text-white/60"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className="truncate max-w-[4rem]">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

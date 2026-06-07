"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Blocks,
  GraduationCap,
  HeartPulse,
  Home,
  Leaf,
  MessageCircle,
  Package,
  ShoppingBag,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertBadge } from "@/components/AlertBadge";
import { useAlerts } from "@/hooks/useAlerts";
import { useModule } from "@/hooks/useModule";
import { localStore } from "@/lib/db";
import { MODULES } from "@/lib/modules/config";
import type { ModuleId } from "@/types";

interface NavLink {
  href: string;
  icon: LucideIcon;
  label: string;
  badge: number;
  highlight?: boolean;
}

const MODULE_NAV: Record<
  ModuleId,
  { href: string; icon: LucideIcon; label: string; highlight?: boolean }
> = {
  commerce: { href: "/products", icon: Package, label: "Produits" },
  agriculture: { href: "/agriculture", icon: Leaf, label: "Agriculture" },
  health: { href: "/health", icon: HeartPulse, label: "Santé" },
  logistics: { href: "/logistics", icon: Truck, label: "Livraisons" },
  education: { href: "/education", icon: GraduationCap, label: "Cours" },
  blockchain: { href: "/blockchain", icon: Blocks, label: "Actifs" },
};

function buildNavLinks(modules: ModuleId[], stockAlerts: number, clientAlerts: number): NavLink[] {
  const links: NavLink[] = [
    { href: "/dashboard", icon: Home, label: "Accueil", badge: stockAlerts + clientAlerts },
  ];

  if (modules.includes("commerce")) {
    links.push(
      { href: "/products", icon: Package, label: "Produits", badge: stockAlerts },
      { href: "/sales", icon: ShoppingBag, label: "Ventes", badge: 0, highlight: true }
    );
  } else {
    const primary = modules[0] ?? "commerce";
    const primaryNav = MODULE_NAV[primary];
    links.push({
      href: primaryNav.href,
      icon: primaryNav.icon,
      label: primaryNav.label,
      badge: 0,
      highlight: true,
    });

    const secondary = modules.find((id) => id !== primary);
    if (secondary) {
      const secondaryNav = MODULE_NAV[secondary];
      links.push({
        href: secondaryNav.href,
        icon: secondaryNav.icon,
        label: secondaryNav.label,
        badge: 0,
      });
    } else {
      const mod = MODULES[primary];
      links.push({
        href: mod.addPath ?? mod.path,
        icon: primaryNav.icon,
        label: "Créer",
        badge: 0,
      });
    }
  }

  links.push(
    { href: "/messages", icon: MessageCircle, label: "Messages", badge: 0 },
    { href: "/profile", icon: User, label: "Profil", badge: clientAlerts }
  );

  return links.slice(0, 5);
}

export function BottomNav() {
  const pathname = usePathname();
  const { summary } = useAlerts();
  const storeId = localStore.get()?.id;
  const { modules } = useModule(storeId);
  const links = buildNavLinks(modules, summary.stockAlerts, summary.clientAlerts);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 safe-bottom">
      <div className="mx-auto max-w-lg px-3 pb-3 pt-1">
        <div className="flex items-stretch justify-around rounded-2xl border border-gray-100/80 bg-white/95 px-1 py-1.5 shadow-nav backdrop-blur-xl">
          {links.map(({ href, icon: Icon, label, badge, highlight }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-all duration-200",
                  active
                    ? highlight
                      ? "bg-wazo-orange text-white shadow-md"
                      : "bg-wazo-green/10 text-wazo-green"
                    : highlight
                      ? "text-wazo-orange"
                      : "text-gray-400 hover:text-wazo-green"
                )}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                  <AlertBadge count={badge} />
                </span>
                <span
                  className={cn(
                    "max-w-[4rem] truncate text-[10px] font-semibold",
                    active && highlight && "text-white"
                  )}
                >
                  {label}
                </span>
                {active && !highlight ? (
                  <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-wazo-green" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

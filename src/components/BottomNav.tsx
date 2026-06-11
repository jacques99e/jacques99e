"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageCircle,
  Package,
  ShoppingBag,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertBadge } from "@/components/AlertBadge";
import { useI18n } from "@/contexts/I18nContext";
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

function moduleNavLabel(moduleId: ModuleId, t: (key: string) => string): string {
  if (moduleId === "logistics") return t("nav.logistics");
  if (moduleId === "education") return t("nav.courses");
  if (moduleId === "blockchain") return t("nav.assets");
  return t(`modules.${moduleId}.title`);
}

function buildNavLinks(
  modules: ModuleId[],
  stockAlerts: number,
  clientAlerts: number,
  t: (key: string) => string
): NavLink[] {
  const links: NavLink[] = [
    { href: "/dashboard", icon: Home, label: t("nav.home"), badge: stockAlerts + clientAlerts },
  ];

  if (modules.includes("commerce")) {
    links.push(
      { href: "/products", icon: Package, label: t("nav.products"), badge: stockAlerts },
      { href: "/sales", icon: ShoppingBag, label: t("nav.sales"), badge: 0, highlight: true }
    );
  } else {
    const primary = modules[0] ?? "commerce";
    const primaryIcon = MODULES[primary].icon;
    links.push({
      href: MODULES[primary].path,
      icon: primaryIcon,
      label: moduleNavLabel(primary, t),
      badge: 0,
      highlight: true,
    });

    const secondary = modules.find((id) => id !== primary);
    if (secondary) {
      links.push({
        href: MODULES[secondary].path,
        icon: MODULES[secondary].icon,
        label: moduleNavLabel(secondary, t),
        badge: 0,
      });
    } else {
      const mod = MODULES[primary];
      links.push({
        href: mod.addPath ?? mod.path,
        icon: primaryIcon,
        label: t("nav.create"),
        badge: 0,
      });
    }
  }

  links.push(
    { href: "/messages", icon: MessageCircle, label: t("nav.messages"), badge: 0 },
    { href: "/profile", icon: User, label: t("nav.profile"), badge: clientAlerts }
  );

  return links.slice(0, 5);
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { summary } = useAlerts();
  const storeId = localStore.get()?.id;
  const { modules } = useModule(storeId);
  const links = buildNavLinks(modules, summary.stockAlerts, summary.clientAlerts, t);

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

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleMenuLinkProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  iconClassName?: string;
}

export function ModuleMenuLink({
  href,
  icon: Icon,
  title,
  description,
  iconClassName = "bg-wazo-green/10 text-wazo-green",
}: ModuleMenuLinkProps) {
  return (
    <Link href={href} className="app-list-item group">
      <div className={cn("shrink-0 rounded-xl p-2.5", iconClassName)}>
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 group-hover:text-wazo-green">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:text-wazo-green" />
    </Link>
  );
}

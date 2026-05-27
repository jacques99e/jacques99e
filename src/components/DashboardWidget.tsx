"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface DashboardWidgetProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  href?: string;
  className?: string;
  children?: React.ReactNode;
}

export function DashboardWidget({
  title,
  value,
  subtitle,
  href,
  className,
  children,
}: DashboardWidgetProps) {
  const inner = (
    <div className={cn("rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800", className)}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
      {value !== undefined && (
        <p className="mt-1 text-xl font-bold text-wazo-green dark:text-emerald-400">{value}</p>
      )}
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block active:opacity-90">
        {inner}
      </Link>
    );
  }
  return inner;
}

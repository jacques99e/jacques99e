import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: "green" | "orange" | "red" | "sky";
  className?: string;
}

const accentStyles = {
  green: "bg-wazo-green/10 text-wazo-green",
  orange: "bg-wazo-orange/10 text-wazo-orange",
  red: "bg-red-50 text-red-600",
  sky: "bg-sky-50 text-sky-600",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "green",
  className,
}: StatCardProps) {
  return (
    <div className={cn("app-card relative overflow-hidden p-4", className)}>
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-wazo-green/[0.04]" />
      <div className="relative">
        <div className={cn("mb-3 inline-flex rounded-xl p-2.5", accentStyles[accent])}>
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <p className="app-label">{label}</p>
        <p className="app-stat-value mt-1">{value}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

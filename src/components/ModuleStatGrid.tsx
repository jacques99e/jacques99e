import { cn } from "@/lib/utils";

interface StatItem {
  value: string | number;
  label: string;
  accent?: string;
}

interface ModuleStatGridProps {
  items: StatItem[];
  columns?: 2 | 3;
}

export function ModuleStatGrid({ items, columns = 2 }: ModuleStatGridProps) {
  return (
    <div
      className={cn(
        "grid gap-2 text-center text-xs",
        columns === 3 ? "grid-cols-3" : "grid-cols-2"
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="app-card p-3">
          <p className={cn("text-xl font-bold", item.accent ?? "text-wazo-green")}>{item.value}</p>
          <p className="mt-0.5 text-gray-500">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

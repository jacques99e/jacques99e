"use client";

import { formatCurrency } from "@/lib/utils";

interface DayData {
  date: string;
  total: number;
}

export function SalesChart({ data }: { data: DayData[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="flex items-end justify-between gap-1 h-28 px-1">
      {data.map((day) => {
        const height = Math.max((day.total / max) * 100, 4);
        const label = new Date(day.date).toLocaleDateString("fr", {
          weekday: "short",
        });
        return (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full max-w-[28px] rounded-t bg-wazo-green transition-all"
              style={{ height: `${height}%`, minHeight: 4 }}
              title={formatCurrency(day.total)}
            />
            <span className="text-[9px] text-gray-500 truncate w-full text-center">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

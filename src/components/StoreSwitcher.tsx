"use client";

import { useActiveStore } from "@/hooks/useActiveStore";

export function StoreSwitcher() {
  const { stores, activeStore, loading, switchStore } = useActiveStore();

  if (loading || stores.length <= 1) return null;

  return (
    <div className="border-b border-wazo-green/10 bg-white/60 px-4 py-2.5 backdrop-blur-sm">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-wazo-green/80">
        Boutique active
      </label>
      <select
        value={activeStore?.id || ""}
        onChange={(e) => {
          const next = stores.find((s) => s.id === e.target.value);
          if (next) void switchStore(next);
        }}
        className="app-input-field h-10 text-xs dark:bg-gray-900"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
            {store.membership_role && store.membership_role !== "owner"
              ? ` (${store.membership_role})`
              : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

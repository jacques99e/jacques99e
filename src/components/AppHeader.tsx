"use client";

import { ConnectionStatus } from "./ConnectionStatus";
import { HeaderAlerts } from "./HeaderAlerts";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function AppHeader({ title, subtitle, right }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-wazo-green via-wazo-green to-wazo-green-light text-white shadow-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          {subtitle ? (
            <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-white/65">
              {subtitle}
            </p>
          ) : (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/65">
              Wazo Digital
            </p>
          )}
          <h1 className="truncate text-lg font-extrabold leading-tight tracking-tight">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <HeaderAlerts />
          <ConnectionStatus />
          {right}
        </div>
      </div>
    </header>
  );
}

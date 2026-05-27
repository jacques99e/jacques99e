"use client";

import { ConnectionStatus } from "./ConnectionStatus";

interface AppHeaderProps {
  title: string;
  right?: React.ReactNode;
}

export function AppHeader({ title, right }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-wazo-green px-4 py-3 text-white shadow-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
        <h1 className="text-lg font-semibold truncate">{title}</h1>
        <div className="flex items-center gap-3 shrink-0">
          <ConnectionStatus />
          {right}
        </div>
      </div>
    </header>
  );
}

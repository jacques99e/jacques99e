"use client";

import { AppHeader } from "@/components/AppHeader";
import { ACHIEVEMENT_CATALOG, getUnlockedAchievements } from "@/lib/engagement";

export default function AchievementsPage() {
  const unlocked = new Set(getUnlockedAchievements());

  return (
    <>
      <AppHeader title="Badges & progression" subtitle="Tous les modules" />
      <main className="app-page space-y-3 pb-6">
        <p className="text-xs text-gray-600">
          Débloquez des badges en utilisant l&apos;app : ventes, formation, livraisons, traçabilité…
          Revenez chaque jour pour faire grandir votre série 🔥
        </p>
        <ul className="space-y-2">
          {ACHIEVEMENT_CATALOG.map((badge) => {
            const done = unlocked.has(badge.id);
            return (
              <li
                key={badge.id}
                className={`app-card flex items-start gap-3 p-4 ${done ? "" : "opacity-55 grayscale"}`}
              >
                <span className="text-2xl">{badge.emoji}</span>
                <div>
                  <p className="font-semibold">{badge.title}</p>
                  <p className="text-xs text-gray-500">{badge.description}</p>
                  <p className="mt-1 text-[10px] font-medium text-[#075E54]">
                    {done ? "✓ Débloqué" : "À débloquer"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}

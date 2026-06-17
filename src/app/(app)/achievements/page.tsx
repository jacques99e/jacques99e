"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  ACHIEVEMENT_CATALOG,
  BADGE_CATEGORIES,
  achievementProgress,
  getUnlockedAchievements,
  type BadgeCategory,
} from "@/lib/engagement";

export default function AchievementsPage() {
  const unlocked = new Set(getUnlockedAchievements());
  const progress = achievementProgress();
  const [category, setCategory] = useState<BadgeCategory | "all">("all");

  const visible = useMemo(() => {
    if (category === "all") return ACHIEVEMENT_CATALOG;
    return ACHIEVEMENT_CATALOG.filter((b) => b.category === category);
  }, [category]);

  return (
    <>
      <AppHeader
        title="Badges & progression"
        subtitle={`${progress.unlocked} / ${progress.total} débloqués`}
      />
      <main className="app-page space-y-3 pb-6">
        <p className="text-xs text-gray-600">
          Plus de {progress.total} badges à collectionner — ventes, formation, livraisons,
          traçabilité, agriculture et plus encore.
        </p>

        <div className="flex flex-wrap gap-2">
          {BADGE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                category === cat.id
                  ? "bg-[#075E54] text-white"
                  : "bg-white text-gray-600 shadow-sm"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <ul className="space-y-2">
          {visible.map((badge) => {
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

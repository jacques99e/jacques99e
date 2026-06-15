"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Lightbulb, Share2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACHIEVEMENT_CATALOG,
  achievementProgress,
  evaluateAchievements,
  getStreak,
  getUnlockedAchievements,
  recordDailyVisit,
  type AchievementDef,
} from "@/lib/engagement";
import { tipOfTheDay } from "@/lib/business-tips";
import { resolveLandingUrl } from "@/lib/public-urls";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";
import type { ModuleId } from "@/types";

interface EngagementHubProps {
  storeId?: string;
  storeName?: string;
  activeModules: ModuleId[];
}

export function EngagementHub({ storeId, storeName, activeModules }: EngagementHubProps) {
  const [streak, setStreak] = useState(getStreak());
  const [progress, setProgress] = useState(achievementProgress());
  const [newBadges, setNewBadges] = useState<AchievementDef[]>([]);
  const tip = tipOfTheDay();

  useEffect(() => {
    const next = recordDailyVisit();
    setStreak(next);
    if (!storeId) return;
    void evaluateAchievements(storeId, activeModules).then((fresh) => {
      if (fresh.length) setNewBadges(fresh);
      setProgress(achievementProgress());
    });
  }, [storeId, activeModules]);

  const unlocked = getUnlockedAchievements();
  const preview = ACHIEVEMENT_CATALOG.filter((a) => unlocked.includes(a.id)).slice(-3);

  const invite = () => {
    const landing = resolveLandingUrl();
    const text = `Je gère mon activité avec Wazo Digital${storeName ? ` (${storeName})` : ""} — caisse MoMo, stock, formation et plus. Essai gratuit : ${landing}`;
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  };

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-3 shadow-sm">
          <div className="flex items-center gap-2 text-orange-800">
            <Flame className="h-4 w-4" />
            <p className="text-xs font-semibold">Série active</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-orange-600">{streak.current} j</p>
          <p className="text-[10px] text-gray-500">Record : {streak.best} jour(s)</p>
        </div>
        <Link
          href="/achievements"
          className="rounded-2xl border border-[#075E54]/20 bg-gradient-to-br from-[#075E54]/10 to-white p-3 shadow-sm"
        >
          <div className="flex items-center gap-2 text-[#075E54]">
            <Trophy className="h-4 w-4" />
            <p className="text-xs font-semibold">Badges</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-[#075E54]">
            {progress.unlocked}/{progress.total}
          </p>
          <p className="text-[10px] text-gray-500">Voir tout →</p>
        </Link>
      </div>

      {newBadges.length > 0 ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-900">
          <p className="font-semibold">Nouveau badge débloqué !</p>
          {newBadges.map((b) => (
            <p key={b.id}>
              {b.emoji} {b.title}
            </p>
          ))}
        </div>
      ) : null}

      {preview.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {preview.map((b) => (
            <span
              key={b.id}
              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium shadow-sm ring-1 ring-gray-100"
              title={b.description}
            >
              {b.emoji} {b.title}
            </span>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
        <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-800">
          <Lightbulb className="h-3.5 w-3.5" />
          Conseil du jour
        </p>
        <p className="text-xs text-gray-600">{tip}</p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full border-[#25D366] text-[#128C7E]"
        onClick={invite}
      >
        <Share2 className="mr-2 h-4 w-4" />
        Inviter un collègue sur WhatsApp
      </Button>
    </section>
  );
}

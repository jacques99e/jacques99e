"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Award, Copy } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import {
  badgeVerifyUrl,
  issueMicroBadge,
  readMicroBadges,
  SKILL_PRESETS,
} from "@/lib/micro-badges";

export default function BadgesPage() {
  const storeId = localStore.get()?.id;
  const [badges, setBadges] = useState(() => readMicroBadges(storeId));
  const [learner, setLearner] = useState("");
  const [course, setCourse] = useState("");
  const [skill, setSkill] = useState(SKILL_PRESETS[0]);
  const [title, setTitle] = useState("");
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const issue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!learner.trim() || !title.trim()) return;
    const updated = issueMicroBadge(
      {
        title: title.trim(),
        skill,
        learnerName: learner.trim(),
        courseTitle: course.trim() || "Formation Wazo",
      },
      storeId
    );
    setBadges(updated);
    const newest = updated[0];
    if (newest) {
      void QRCode.toDataURL(badgeVerifyUrl(newest.verifyToken), { width: 120 }).then((url) =>
        setQrMap((m) => ({ ...m, [newest.id]: url }))
      );
    }
    setLearner("");
    setTitle("");
  };

  const copyVerify = (token: string) => {
    void navigator.clipboard.writeText(badgeVerifyUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-violet-900 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Award className="h-5 w-5" /> Micro-Badges
          </h1>
          <Link href="/education"><ArrowLeft className="h-4 w-4" /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="rounded-2xl bg-violet-50 p-4 text-xs text-violet-900">
          Compétences empilables avec QR vérifiable — reconnues par employeurs et bailleurs sur le continent.
        </p>

        <form onSubmit={issue} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <Label>Apprenant</Label>
            <Input value={learner} onChange={(e) => setLearner(e.target.value)} required />
          </div>
          <div>
            <Label>Titre du badge</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Certifié Excel" required />
          </div>
          <div>
            <Label>Compétence</Label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
            >
              {SKILL_PRESETS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Cours lié</Label>
            <Input value={course} onChange={(e) => setCourse(e.target.value)} />
          </div>
          <Button type="submit" className="w-full">Délivrer le badge</Button>
        </form>

        <ul className="space-y-3">
          {badges.map((b) => (
            <li key={b.id} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
              {qrMap[b.id] ? (
                <Image src={qrMap[b.id]} alt="QR badge" width={80} height={80} unoptimized />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded bg-violet-100">
                  <Award className="h-8 w-8 text-violet-600" />
                </div>
              )}
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-semibold">{b.title}</p>
                <p className="text-gray-600">{b.learnerName} — {b.skill}</p>
                <p className="text-gray-400">{new Date(b.issuedAt).toLocaleDateString("fr-FR")}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7"
                  onClick={() => copyVerify(b.verifyToken)}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  {copied === b.verifyToken ? "Copié !" : "Lien vérif"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

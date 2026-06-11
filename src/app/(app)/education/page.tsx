"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Copy, MessageCircle, Link2, UserCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { downloadCsv, downloadSimplePdf } from "@/lib/export";
import { ModuleCompetitiveEdge } from "@/components/ModuleCompetitiveEdge";
import { ModulePremiumEdge } from "@/components/ModulePremiumEdge";
import { ModuleMenuLink } from "@/components/ModuleMenuLink";
import { ModulePublicPortals } from "@/components/ModulePublicPortals";
import { ModuleStatGrid } from "@/components/ModuleStatGrid";
import { formationUrl } from "@/lib/education-public";
import { listCourses } from "@/lib/education";
import { shareCourseInvite } from "@/lib/module-share";
import { buildWhatsAppShareUrl } from "@/lib/module-local-tools";
import type { Course } from "@/types";

export default function EducationPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [copiedCourseId, setCopiedCourseId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  useEffect(() => {
    if (store) listCourses(store.id).then(setCourses);
  }, [store]);

  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <AppHeader title={t("modules.education.title")} subtitle="Module" />
      <main className="app-page space-y-4 pb-6">
        <ModuleStatGrid
          items={[
            { value: courses.length, label: "Cours", accent: "text-violet-600" },
            { value: courses.filter((c) => c.is_public).length, label: "Publics", accent: "text-violet-600" },
          ]}
        />
        <ModulePublicPortals moduleId="education" />
        <ModuleCompetitiveEdge moduleId="education" />
        <ModulePremiumEdge moduleId="education" />

        <ModuleMenuLink
          href="/education/presence"
          icon={UserCheck}
          title="Feuille de présence"
          description="Émargement par cours avec export PDF"
          iconClassName="bg-violet-600/10 text-violet-800"
        />

        <Button asChild className="w-full">
          <Link href="/education/courses/new">
            <Plus className="h-4 w-4" />
            {t("education.newCourse")}
          </Link>
        </Button>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un cours..."
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `cours-${new Date().toISOString().slice(0, 10)}.csv`,
                filteredCourses.map((course) => ({
                  id: course.id,
                  title: course.title,
                  invite_code: course.invite_code ?? "",
                  is_public: course.is_public ? "oui" : "non",
                }))
              )
            }
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void downloadSimplePdf(
                "Liste des cours",
                filteredCourses.map(
                  (course) =>
                    `${course.title} | Invite: ${course.invite_code ?? "n/a"} | Public: ${
                      course.is_public ? "Oui" : "Non"
                    }`
                ),
                `cours-${new Date().toISOString().slice(0, 10)}.pdf`
              )
            }
          >
            Export PDF
          </Button>
        </div>
        <ul className="space-y-2">
          {filteredCourses.map((c) => (
            <li key={c.id}>
              <div className="app-card p-3">
                <Link href={`/education/courses/${encodeURIComponent(c.id)}`} className="block">
                  <p className="font-medium">{c.title}</p>
                  {c.invite_code && (
                    <p className="text-xs text-gray-500 font-mono">{t("education.invite")}: {c.invite_code}</p>
                  )}
                </Link>
                {c.invite_code ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(c.invite_code ?? "");
                        setCopiedCourseId(c.id);
                        window.setTimeout(() => setCopiedCourseId(null), 1400);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedCourseId === c.id ? "Code copié" : "Code"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(formationUrl(c.invite_code!));
                        setCopiedLinkId(c.id);
                        window.setTimeout(() => setCopiedLinkId(null), 1400);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs text-violet-800 hover:bg-violet-200"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {copiedLinkId === c.id ? "Lien copié" : "Lien portail"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const text = shareCourseInvite({
                          courseTitle: c.title,
                          inviteCode: c.invite_code!,
                          storeName: store?.name,
                        });
                        window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-3 py-1 text-xs text-[#128C7E] hover:bg-[#25D366]/25"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Inviter WhatsApp
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {filteredCourses.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm dark:bg-gray-800">
            Aucun cours trouvé.
          </p>
        ) : null}
      </main>
    </>
  );
}

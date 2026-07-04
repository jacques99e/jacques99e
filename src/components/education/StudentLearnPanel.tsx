"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { ModuleQuizPanel } from "@/components/education/ModuleQuizPanel";
import { ModuleSubtitlesPanel } from "@/components/education/ModuleSubtitlesPanel";
import { downloadCertificatePdfWithQr } from "@/lib/certificate";
import {
  computeProgressPercent,
  getModuleQuiz,
  isLessonComplete,
  isModuleFullyComplete,
  isModuleUnlocked,
  isQuizPassed,
  moduleHasQuiz,
  readLocalProgress,
  saveLearnerProgress,
} from "@/lib/education-extras";
import type { CourseEnrollment, CourseModule, ModuleQuiz } from "@/types";

interface StudentLearnPanelProps {
  courseId: string;
  courseTitle?: string;
  modules: CourseModule[];
  enrollments: CourseEnrollment[];
  onProgressUpdated: () => void;
  /** Portail public : quiz déjà chargés */
  quizzesByModuleId?: Record<string, ModuleQuiz>;
  /** Portail public : pas de sélecteur apprenant */
  fixedEnrollmentId?: string;
  /** Code invitation pour sync cloud publique */
  publicInviteCode?: string;
}

export function StudentLearnPanel({
  courseId,
  courseTitle = "Formation",
  modules,
  enrollments,
  onProgressUpdated,
  quizzesByModuleId,
  fixedEnrollmentId,
  publicInviteCode,
}: StudentLearnPanelProps) {
  const [enrollmentId, setEnrollmentId] = useState(fixedEnrollmentId ?? "");
  const [percent, setPercent] = useState(0);
  const [tick, setTick] = useState(0);
  const [hasQuizByModuleId, setHasQuizByModuleId] = useState<Record<string, boolean>>({});
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState("");

  const sortedModules = useMemo(
    () => [...modules].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [modules]
  );

  const orderedIds = useMemo(() => sortedModules.map((m) => m.id), [sortedModules]);

  const activeEnrollment = enrollments.find((e) => e.id === enrollmentId);

  useEffect(() => {
    if (fixedEnrollmentId) setEnrollmentId(fixedEnrollmentId);
  }, [fixedEnrollmentId]);

  useEffect(() => {
    if (quizzesByModuleId) {
      const map: Record<string, boolean> = {};
      for (const id of orderedIds) {
        map[id] = moduleHasQuiz(quizzesByModuleId[id]);
      }
      setHasQuizByModuleId(map);
      return;
    }

    let cancelled = false;
    (async () => {
      const map: Record<string, boolean> = {};
      await Promise.all(
        sortedModules.map(async (m) => {
          const quiz = await getModuleQuiz(m.id, courseId);
          map[m.id] = moduleHasQuiz(quiz);
        })
      );
      if (!cancelled) setHasQuizByModuleId(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [sortedModules, courseId, tick, quizzesByModuleId, orderedIds]);

  const refreshPercent = useCallback(() => {
    if (!enrollmentId) return;
    const meta = readLocalProgress(courseId, enrollmentId);
    setPercent(computeProgressPercent(orderedIds, meta, hasQuizByModuleId));
  }, [courseId, enrollmentId, orderedIds, hasQuizByModuleId]);

  useEffect(() => {
    refreshPercent();
  }, [refreshPercent, tick]);

  const persistProgress = async (meta: ReturnType<typeof readLocalProgress>) => {
    const p = await saveLearnerProgress(
      courseId,
      enrollmentId,
      meta,
      orderedIds,
      hasQuizByModuleId,
      publicInviteCode
    );
    setPercent(p);
    setTick((t) => t + 1);
    onProgressUpdated();
  };

  const markLessonDone = async (moduleId: string) => {
    if (!enrollmentId) return;
    const meta = readLocalProgress(courseId, enrollmentId);
    if (!meta.completedModuleIds.includes(moduleId)) {
      meta.completedModuleIds.push(moduleId);
    }
    await persistProgress(meta);
  };

  const markQuizPassed = async (moduleId: string) => {
    if (!enrollmentId) return;
    const meta = readLocalProgress(courseId, enrollmentId);
    if (!meta.passedQuizModuleIds.includes(moduleId)) {
      meta.passedQuizModuleIds.push(moduleId);
    }
    await persistProgress(meta);
  };

  const downloadCertificate = async () => {
    if (!activeEnrollment || !enrollmentId) {
      setCertError("Sélectionnez un apprenant.");
      return;
    }
    if (percent < 100) {
      setCertError("Terminez toutes les leçons et quiz avant de télécharger le certificat.");
      return;
    }
    const progressMeta = readLocalProgress(courseId, enrollmentId);
    setCertLoading(true);
    setCertError("");
    try {
      await saveLearnerProgress(
        courseId,
        enrollmentId,
        progressMeta,
        orderedIds,
        hasQuizByModuleId,
        publicInviteCode
      );
      await downloadCertificatePdfWithQr(
        activeEnrollment.student_name,
        courseTitle,
        "Wazo Digital",
        {
          enrollmentId: activeEnrollment.id,
          inviteCode: publicInviteCode,
          progressMeta,
          orderedModuleIds: orderedIds,
          hasQuizByModuleId,
        }
      );
    } catch (err) {
      setCertError(
        err instanceof Error ? err.message : "Impossible de télécharger le certificat."
      );
    } finally {
      setCertLoading(false);
    }
  };

  if (!enrollments.length) {
    return (
      <p className="text-xs text-gray-500">
        Inscrivez d&apos;abord un apprenant pour suivre sa progression.
      </p>
    );
  }

  const meta = enrollmentId ? readLocalProgress(courseId, enrollmentId) : null;

  return (
    <section className="space-y-3 rounded-2xl border border-[#075E54]/20 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-[#075E54]">
        {fixedEnrollmentId ? "Mon parcours" : "Espace apprenant"}
      </h2>
      <p className="text-xs text-gray-500">
        Parcours séquentiel : terminez chaque leçon, puis réussissez le quiz (si présent) pour
        débloquer la suivante.
      </p>

      {!fixedEnrollmentId ? (
        <label className="block text-xs font-medium">
          Apprenant
          <select
            value={enrollmentId}
            onChange={(e) => setEnrollmentId(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-lg border border-gray-200 px-2 text-sm"
          >
            <option value="">Choisir…</option>
            {enrollments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.student_name} ({e.progress_percent}%)
              </option>
            ))}
          </select>
        </label>
      ) : activeEnrollment ? (
        <p className="text-sm font-medium text-gray-800">{activeEnrollment.student_name}</p>
      ) : null}

      {enrollmentId && meta ? (
        <>
          <div className="rounded-lg bg-[#075E54]/10 px-3 py-2">
            <p className="text-xs text-gray-600">Progression du parcours</p>
            <p className="text-lg font-bold text-[#075E54]">{percent}%</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-[#075E54] transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            {percent >= 100 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-green-700">
                  Félicitations — parcours terminé !
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full bg-[#FF6F00] hover:bg-[#FF6F00]/90"
                  disabled={certLoading}
                  onClick={() => void downloadCertificate()}
                >
                  <Award className="mr-1 h-4 w-4" />
                  {certLoading ? "Préparation…" : "Télécharger mon certificat PDF"}
                </Button>
                {certLoading ? (
                  <p className="text-xs text-gray-600">
                    Le téléchargement va s&apos;ouvrir dans le navigateur. Si rien ne se passe,
                    autorisez les téléchargements pour ce site.
                  </p>
                ) : null}
                {certError ? <p className="text-xs text-red-600">{certError}</p> : null}
              </div>
            ) : null}
          </div>

          <ul className="space-y-3">
            {sortedModules.map((m, index) => {
              const hasQuiz = hasQuizByModuleId[m.id] ?? false;
              const unlocked = isModuleUnlocked(index, orderedIds, meta, hasQuizByModuleId);
              const lessonDone = isLessonComplete(m.id, meta);
              const quizDone = isQuizPassed(m.id, meta);
              const fullyDone = isModuleFullyComplete(m.id, meta, hasQuiz);
              const prevTitle = index > 0 ? sortedModules[index - 1]?.title : null;
              const preloaded = quizzesByModuleId?.[m.id] ?? undefined;

              if (!unlocked) {
                return (
                  <li
                    key={m.id}
                    className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 opacity-80"
                  >
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Leçon {index + 1} — {m.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Verrouillée. Terminez la leçon précédente
                        {prevTitle ? ` « ${prevTitle} »` : ""}
                        {hasQuizByModuleId[orderedIds[index - 1] ?? ""]
                          ? " et son quiz"
                          : ""}{" "}
                        pour continuer.
                      </p>
                    </div>
                  </li>
                );
              }

              return (
                <li
                  key={m.id}
                  className={`rounded-xl border p-3 ${
                    fullyDone ? "border-green-200 bg-green-50/40" : "border-gray-100"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      Leçon {index + 1} — {m.title}
                    </p>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1 text-[10px]">
                      {lessonDone ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">
                          Leçon ✓
                        </span>
                      ) : null}
                      {hasQuiz && quizDone ? (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                          Quiz ✓
                        </span>
                      ) : hasQuiz ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                          Quiz requis
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {m.content ? <p className="mb-2 text-xs text-gray-600">{m.content}</p> : null}
                  {m.media_url ? <LessonVideoPlayer url={m.media_url} title={m.title} /> : null}
                  <ModuleSubtitlesPanel moduleId={m.id} mode="view" />

                  {!lessonDone ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => void markLessonDone(m.id)}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      J&apos;ai terminé cette leçon
                    </Button>
                  ) : null}

                  {lessonDone && hasQuiz && !quizDone ? (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                      Réussissez le quiz ci-dessous (score minimum requis) pour débloquer la leçon
                      suivante.
                    </p>
                  ) : null}

                  {lessonDone && hasQuiz ? (
                    <ModuleQuizPanel
                      moduleId={m.id}
                      courseId={courseId}
                      moduleTitle={m.title}
                      mode="take"
                      preloadedQuiz={preloaded}
                      onPassed={() => void markQuizPassed(m.id)}
                    />
                  ) : null}

                  {fullyDone && index < sortedModules.length - 1 ? (
                    <p className="mt-2 text-center text-xs font-medium text-[#075E54]">
                      Leçon suivante débloquée ↓
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}

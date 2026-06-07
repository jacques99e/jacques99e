"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Film, Link2, MessageSquare, Upload } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { ModuleQuizPanel } from "@/components/education/ModuleQuizPanel";
import { ModuleSubtitlesPanel } from "@/components/education/ModuleSubtitlesPanel";
import { LearnerLiveDashboard } from "@/components/education/LearnerLiveDashboard";
import { StudentLearnPanel } from "@/components/education/StudentLearnPanel";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { uploadCourseVideo } from "@/lib/course-media";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { buildWhatsAppShareUrl } from "@/lib/module-local-tools";
import { generateCertificatePdfWithQr, issueCertificateToken } from "@/lib/certificate";
import {
  createCourseModule,
  createEnrollment,
  listModules,
  listEnrollments,
  setCoursePublic,
} from "@/lib/education";
import { formationUrl } from "@/lib/education-public";
import { looksLikePhone } from "@/lib/sms";
import { mapErrorToUserMessage } from "@/lib/user-messages";
import { downloadCsv, downloadSimplePdf } from "@/lib/export";
import type { Course, CourseEnrollment, CourseModule } from "@/types";

export default function CourseDetailPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleContent, setModuleContent] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [savingModule, setSavingModule] = useState(false);
  const [savingEnrollment, setSavingEnrollment] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    if (db) db.courses.get(id).then((c) => setCourse(c ?? null));
    const [mods, enrolls] = await Promise.all([listModules(id), listEnrollments(id)]);
    setModules(mods);
    setEnrollments(enrolls);
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const shareCourseWhatsApp = () => {
    if (!course?.invite_code) return;
    const link = formationUrl(course.invite_code);
    const text = `Rejoignez ma formation "${course.title}" sur Wazo Digital : ${link}`;
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  };

  const copyFormationLink = async () => {
    if (!course?.invite_code) return;
    const link = formationUrl(course.invite_code);
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Lien formation copié.");
    } catch {
      setNotice(link);
    }
  };

  const togglePublic = async (next: boolean) => {
    if (!course) return;
    await setCoursePublic(course.id, next);
    setCourse({ ...course, is_public: next });
    setNotice(next ? "Cours visible sur le portail formation." : "Cours retiré du portail public.");
  };

  const sendFormationSms = async (phone: string, name: string, enrollmentId?: string) => {
    const res = await fetch("/api/education/invite-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: id,
        phone,
        student_name: name,
        enrollment_id: enrollmentId,
      }),
    });
    const json = (await res.json()) as { success: boolean; error?: string; message?: string };
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Envoi SMS impossible");
    }
    return json.message || "SMS envoyé";
  };

  const inviteBySms = async () => {
    if (!invitePhone.trim() || !course?.is_public) return;
    setSendingSms(true);
    setError("");
    try {
      const msg = await sendFormationSms(invitePhone.trim(), studentName.trim() || "Apprenant");
      setNotice(msg);
      setInvitePhone("");
    } catch (err) {
      setError(mapErrorToUserMessage(err, "Impossible d'envoyer le SMS."));
    } finally {
      setSendingSms(false);
    }
  };

  const cert = async (name: string, enrollmentId?: string) => {
    if (!course) return;
    const targetId =
      enrollmentId || enrollments.find((e) => e.student_name === name)?.id;
    if (targetId) {
      const { token } = await issueCertificateToken({ enrollmentId: targetId });
      const blob = await generateCertificatePdfWithQr(
        name,
        course.title,
        "Wazo Formateur",
        token
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificat-${name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    setError("Inscrivez l'apprenant avant d'émettre un certificat vérifiable.");
  };

  const addModule = async () => {
    if (!moduleTitle.trim()) return;
    setSavingModule(true);
    setError("");
    setNotice("");
    try {
      let mediaUrl: string | null = videoLink.trim() || null;

      if (videoFile && user?.id) {
        setNotice("Envoi de la vidéo en cours… (connexion stable recommandée)");
        mediaUrl = await uploadCourseVideo(user.id, id, videoFile);
      }

      const result = await createCourseModule(id, {
        title: moduleTitle.trim(),
        content: moduleContent.trim() || null,
        media_url: mediaUrl,
      });
      const created = result.module;
      if (!result.synced) {
        setNotice(result.message ?? "Module sauvegardé localement, synchronisation en attente.");
      } else {
        setNotice(mediaUrl ? "Leçon avec vidéo enregistrée." : "Module enregistré.");
      }
      await logAuditEvent({
        action: "course_module_created",
        entityType: "course_module",
        entityId: created?.id,
        payload: { course_id: id, title: moduleTitle.trim(), has_video: Boolean(mediaUrl) },
      });
      setModuleTitle("");
      setModuleContent("");
      setVideoLink("");
      setVideoFile(null);
      await reload();
    } catch (err) {
      setError(mapErrorToUserMessage(err, "Impossible d'ajouter le module pour le moment."));
    } finally {
      setSavingModule(false);
    }
  };

  const enrollStudent = async () => {
    if (!studentName.trim()) return;
    setSavingEnrollment(true);
    setError("");
    setNotice("");
    try {
      const enrolledName = studentName.trim();
      const contact = studentEmail.trim();
      const created = await createEnrollment(id, {
        student_name: enrolledName,
        student_email: contact || null,
      });
      await logAuditEvent({
        action: "course_enrollment_created",
        entityType: "course_enrollment",
        entityId: created?.id,
        payload: { course_id: id, student_name: enrolledName },
      });
      setStudentName("");
      setStudentEmail("");
      await reload();

      if (contact && looksLikePhone(contact) && course?.is_public) {
        try {
          const smsMsg = await sendFormationSms(contact, enrolledName, created?.id);
          setNotice((prev) => (prev ? `${prev} — ${smsMsg}` : smsMsg));
        } catch (smsErr) {
          setNotice(
            (prev) =>
              `${prev || "Inscription OK"} — SMS non envoyé : ${
                smsErr instanceof Error ? smsErr.message : "erreur"
              }`
          );
        }
      }
    } catch (err) {
      setError(mapErrorToUserMessage(err, "Impossible d'inscrire l'étudiant pour le moment."));
    } finally {
      setSavingEnrollment(false);
    }
  };

  if (!course) return <p className="p-4">{t("common.loading")}</p>;

  return (
    <>
      <AppHeader title={course.title} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{course.description}</p>

        <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm dark:bg-gray-800">
          <input
            type="checkbox"
            checked={course.is_public ?? false}
            onChange={(e) => void togglePublic(e.target.checked)}
          />
          Cours public (portail /formation)
        </label>

        {course.invite_code && course.is_public ? (
          <div className="space-y-2 rounded-xl bg-amber-50 px-3 py-3 text-xs">
            <p>
              {t("education.invite")}: <strong className="font-mono">{course.invite_code}</strong>
            </p>
            <p className="break-all text-gray-600">{formationUrl(course.invite_code)}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void copyFormationLink()}>
                Copier le lien
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={shareCourseWhatsApp}>
                Partager WhatsApp
              </Button>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="Téléphone pour invitation SMS"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sendingSms || !invitePhone.trim()}
                onClick={() => void inviteBySms()}
              >
                <MessageSquare className="mr-1 h-3 w-3" />
                {sendingSms ? "…" : "SMS"}
              </Button>
            </div>
          </div>
        ) : course.is_public && !course.invite_code ? (
          <p className="text-xs text-amber-700">
            Code invitation en cours de génération — synchronisez en ligne puis rechargez.
          </p>
        ) : null}

        <section>
          <h2 className="mb-2 text-sm font-medium">{t("education.modules")}</h2>
          <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `modules-${course.title}-${new Date().toISOString().slice(0, 10)}.csv`,
                  modules.map((module) => ({
                    id: module.id,
                    title: module.title,
                    content: module.content ?? "",
                    video: module.media_url ?? "",
                    sort_order: module.sort_order,
                  }))
                )
              }
            >
              Export modules CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void downloadSimplePdf(
                  `Modules - ${course.title}`,
                  modules.map(
                    (module) =>
                      `${module.title} | ${module.content ?? "Sans texte"} | ${module.media_url ? "Vidéo" : "Sans vidéo"}`
                  ),
                  `modules-${course.title}-${new Date().toISOString().slice(0, 10)}.pdf`
                )
              }
            >
              Export modules PDF
            </Button>
          </div>

          <div className="mb-3 space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <p className="text-xs font-medium text-[#075E54]">Nouvelle leçon</p>
            <Input
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
              placeholder="Titre de la leçon"
            />
            <Input
              value={moduleContent}
              onChange={(e) => setModuleContent(e.target.value)}
              placeholder="Résumé texte (lisible hors ligne)"
            />

            <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-3">
              <Label className="flex items-center gap-2 text-xs text-gray-700">
                <Link2 className="h-3.5 w-3.5" />
                Lien vidéo YouTube / Facebook (économise la data)
              </Label>
              <Input
                value={videoLink}
                onChange={(e) => {
                  setVideoLink(e.target.value);
                  if (e.target.value.trim()) setVideoFile(null);
                }}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-3">
              <Label className="flex items-center gap-2 text-xs text-gray-700">
                <Upload className="h-3.5 w-3.5" />
                Ou importer un fichier vidéo (MP4, max 80 Mo)
              </Label>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="block w-full text-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setVideoFile(file);
                  if (file) setVideoLink("");
                }}
              />
              {videoFile ? (
                <p className="text-xs text-gray-500">{videoFile.name}</p>
              ) : null}
            </div>

            <Button size="sm" className="w-full" onClick={addModule} disabled={savingModule}>
              {savingModule ? t("common.loading") : "Ajouter la leçon"}
            </Button>
          </div>

          <ul className="space-y-3 text-sm">
            {modules.map((m) => (
              <li key={m.id} className="space-y-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
                <div className="flex items-start gap-2">
                  {m.media_url ? (
                    <Film className="mt-0.5 h-4 w-4 shrink-0 text-[#075E54]" />
                  ) : null}
                  <div>
                    <p className="font-medium">{m.title}</p>
                    {m.content ? <p className="text-xs text-gray-500">{m.content}</p> : null}
                  </div>
                </div>
                {m.media_url ? <LessonVideoPlayer url={m.media_url} title={m.title} /> : null}
                <ModuleSubtitlesPanel moduleId={m.id} mode="edit" />
                <ModuleQuizPanel
                  moduleId={m.id}
                  courseId={id}
                  moduleTitle={m.title}
                  mode="edit"
                />
              </li>
            ))}
            {modules.length === 0 && <p className="text-xs text-gray-400">{t("common.noData")}</p>}
          </ul>
        </section>

        <section className="space-y-2 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <h2 className="text-sm font-medium">{t("education.enroll")}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `inscriptions-${course.title}-${new Date().toISOString().slice(0, 10)}.csv`,
                  enrollments.map((enrollment) => ({
                    id: enrollment.id,
                    student_name: enrollment.student_name,
                    student_email: enrollment.student_email ?? "",
                    progress_percent: enrollment.progress_percent,
                  }))
                )
              }
            >
              Export inscriptions CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void downloadSimplePdf(
                  `Inscriptions - ${course.title}`,
                  enrollments.map(
                    (enrollment) =>
                      `${enrollment.student_name} | ${enrollment.student_email ?? "Sans email"} | ${enrollment.progress_percent}%`
                  ),
                  `inscriptions-${course.title}-${new Date().toISOString().slice(0, 10)}.pdf`
                )
              }
            >
              Export inscriptions PDF
            </Button>
          </div>
          <div className="space-y-2">
            <Input
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder={t("education.studentName")}
            />
            <Input
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="Téléphone ou email (optionnel)"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={enrollStudent} disabled={savingEnrollment}>
                {savingEnrollment ? t("common.loading") : "Inscrire"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => studentName && cert(studentName)}>
                {t("education.certificate")}
              </Button>
            </div>
          </div>
          {notice ? <p className="text-xs text-amber-600">{notice}</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </section>

        <LearnerLiveDashboard
          courseId={id}
          initialEnrollments={enrollments}
          onRefresh={() => void reload()}
        />

        <StudentLearnPanel
          courseId={id}
          courseTitle={course.title}
          modules={modules}
          enrollments={enrollments}
          onProgressUpdated={() => void reload()}
        />
      </main>
    </>
  );
}

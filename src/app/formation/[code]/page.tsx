"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { StudentLearnPanel } from "@/components/education/StudentLearnPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  enrollPublicStudent,
  fetchPublicCourse,
  loadFormationSession,
  saveFormationSession,
} from "@/lib/education-public";
import type { Course, CourseEnrollment, CourseModule, ModuleQuiz } from "@/types";

export default function PublicFormationPage() {
  const params = useParams();
  const code = decodeURIComponent(params.code as string).trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, ModuleQuiz>>({});
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentContact, setStudentContact] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchPublicCourse(code);
        if (cancelled) return;
        setCourse(payload.course);
        setModules(payload.modules);
        setQuizzes(payload.quizzes);
        const saved = loadFormationSession(code);
        if (saved) setEnrollment(saved);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Cours introuvable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    setJoining(true);
    setError("");
    try {
      const row = await enrollPublicStudent(code, studentName.trim(), studentContact.trim());
      setEnrollment(row);
      saveFormationSession(code, row);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0]">
        <Loader2 className="h-8 w-8 animate-spin text-[#075E54]" />
      </main>
    );
  }

  if (error && !course) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FFF8F0] px-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/formation" className="text-sm text-[#075E54] underline">
          Retour
        </Link>
      </main>
    );
  }

  if (!course) return null;

  return (
    <main className="min-h-screen bg-[#FFF8F0] px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-[#075E54]">Formation publique</p>
          <h1 className="text-lg font-bold text-gray-900">{course.title}</h1>
          {course.description ? (
            <p className="mt-1 text-sm text-gray-600">{course.description}</p>
          ) : null}
        </header>

        {!enrollment ? (
          <form onSubmit={join} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm font-medium">Rejoindre le cours</p>
            <Input
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Votre nom complet"
              required
            />
            <Input
              value={studentContact}
              onChange={(e) => setStudentContact(e.target.value)}
              placeholder="Téléphone ou WhatsApp (optionnel)"
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={joining}>
              {joining ? "Inscription…" : "Commencer"}
            </Button>
          </form>
        ) : (
          <StudentLearnPanel
            courseId={course.id}
            courseTitle={course.title}
            modules={modules}
            enrollments={[enrollment]}
            quizzesByModuleId={quizzes}
            fixedEnrollmentId={enrollment.id}
            publicInviteCode={code}
            onProgressUpdated={() => {
              /* sync via API publique */
            }}
          />
        )}

        <p className="text-center text-xs text-gray-500">
          <Link href="/formation" className="underline">
            Autre code
          </Link>
        </p>
      </div>
    </main>
  );
}

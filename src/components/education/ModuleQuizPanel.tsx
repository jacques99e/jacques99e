"use client";

import { useEffect, useState } from "react";
import { HelpCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEmptyQuestion,
  getModuleQuiz,
  gradeQuiz,
  saveModuleQuiz,
} from "@/lib/education-extras";
import type { ModuleQuiz } from "@/types";

interface ModuleQuizPanelProps {
  moduleId: string;
  courseId: string;
  moduleTitle: string;
  mode: "edit" | "take";
  onPassed?: () => void;
  /** Quiz préchargé (portail public) */
  preloadedQuiz?: ModuleQuiz | null;
}

export function ModuleQuizPanel({
  moduleId,
  courseId,
  moduleTitle,
  mode,
  onPassed,
  preloadedQuiz,
}: ModuleQuizPanelProps) {
  const [quiz, setQuiz] = useState<ModuleQuiz | null>(preloadedQuiz ?? null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preloadedQuiz !== undefined) {
      setQuiz(preloadedQuiz);
      return;
    }
    void getModuleQuiz(moduleId, courseId).then(setQuiz);
  }, [moduleId, courseId, preloadedQuiz]);

  if (mode === "edit") {
    const draft: ModuleQuiz = quiz ?? {
      module_id: moduleId,
      course_id: courseId,
      title: `Quiz — ${moduleTitle}`,
      passing_score: 70,
      questions: [],
    };

    const updateDraft = (next: ModuleQuiz) => setQuiz(next);

    return (
      <div className="mt-2 space-y-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-3">
        <Label className="flex items-center gap-2 text-xs font-medium text-amber-900">
          <HelpCircle className="h-3.5 w-3.5" />
          Quiz de la leçon
        </Label>
        <Input
          value={draft.title}
          onChange={(e) => updateDraft({ ...draft, title: e.target.value })}
          placeholder="Titre du quiz"
          className="text-sm"
        />
        <div className="flex items-center gap-2 text-xs">
          <span>Score minimum (%)</span>
          <Input
            type="number"
            min={50}
            max={100}
            className="h-8 w-20"
            value={draft.passing_score}
            onChange={(e) =>
              updateDraft({ ...draft, passing_score: Number(e.target.value) || 70 })
            }
          />
        </div>
        {draft.questions.map((q, qi) => (
          <div key={q.id} className="space-y-1 rounded-lg bg-white p-2">
            <Input
              value={q.prompt}
              onChange={(e) => {
                const questions = [...draft.questions];
                questions[qi] = { ...q, prompt: e.target.value };
                updateDraft({ ...draft, questions });
              }}
              placeholder={`Question ${qi + 1}`}
              className="text-sm"
            />
            {q.choices.map((choice, ci) => (
              <div key={ci} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  checked={q.correctIndex === ci}
                  onChange={() => {
                    const questions = [...draft.questions];
                    questions[qi] = { ...q, correctIndex: ci };
                    updateDraft({ ...draft, questions });
                  }}
                />
                <Input
                  value={choice}
                  onChange={(e) => {
                    const questions = [...draft.questions];
                    const choices = [...q.choices];
                    choices[ci] = e.target.value;
                    questions[qi] = { ...q, choices };
                    updateDraft({ ...draft, questions });
                  }}
                  placeholder={`Réponse ${ci + 1}`}
                  className="h-8 text-xs"
                />
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-600"
              onClick={() =>
                updateDraft({
                  ...draft,
                  questions: draft.questions.filter((_, i) => i !== qi),
                })
              }
            >
              <Trash2 className="h-3 w-3" />
              Supprimer
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              updateDraft({
                ...draft,
                questions: [...draft.questions, createEmptyQuestion()],
              })
            }
          >
            <Plus className="h-3 w-3" />
            Ajouter une question
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !draft.questions.length}
            onClick={async () => {
              setSaving(true);
              await saveModuleQuiz(draft);
              setSaving(false);
            }}
          >
            {saving ? "…" : "Enregistrer le quiz"}
          </Button>
        </div>
      </div>
    );
  }

  if (!quiz?.questions.length) return null;

  const submit = () => {
    const graded = gradeQuiz(quiz, answers);
    setResult(graded);
    if (graded.passed) onPassed?.();
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-[#075E54]/20 bg-white p-3">
      <p className="text-xs font-semibold text-[#075E54]">{quiz.title}</p>
      {quiz.questions.map((q, i) => (
        <fieldset key={q.id} className="space-y-1">
          <legend className="text-xs font-medium">
            {i + 1}. {q.prompt}
          </legend>
          {q.choices.map((choice, ci) => (
            <label key={ci} className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === ci}
                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: ci }))}
              />
              {choice}
            </label>
          ))}
        </fieldset>
      ))}
      <Button type="button" size="sm" onClick={submit}>
        Valider le quiz
      </Button>
      {result ? (
        <p
          className={`text-xs font-medium ${result.passed ? "text-green-700" : "text-red-600"}`}
        >
          {result.passed
            ? `Réussi (${result.score}%) — bravo !`
            : `Score ${result.score}% — minimum ${quiz.passing_score}% requis.`}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function FormationLandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/formation/${encodeURIComponent(trimmed)}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FFF8F0] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-center gap-2 text-[#075E54]">
          <GraduationCap className="h-8 w-8" />
          <h1 className="text-xl font-bold">Formation Wazo</h1>
        </div>
        <p className="mb-6 text-center text-sm text-gray-600">
          Entrez le code reçu par WhatsApp ou de votre formateur pour accéder au cours.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code invitation (ex: a1b2c3)"
            className="text-center font-mono"
            required
          />
          <Button type="submit" className="w-full bg-[#FF6F00] hover:bg-[#FF6F00]/90">
            Accéder au cours
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">
          Formateur ?{" "}
          <Link href="/login" className="font-medium text-[#075E54] underline">
            Connexion à l&apos;app
          </Link>
        </p>
      </div>
    </main>
  );
}

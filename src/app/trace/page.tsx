"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TraceLandingPage() {
  const router = useRouter();
  const [hash, setHash] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = hash.trim();
    if (!trimmed) return;
    router.push(`/trace/${encodeURIComponent(trimmed.slice(0, 16))}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FFF8F0] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-center gap-2 text-indigo-700">
          <Shield className="h-8 w-8" />
          <h1 className="text-xl font-bold">Traçabilité Wazo</h1>
        </div>
        <p className="mb-6 text-center text-sm text-gray-600">
          Vérifiez l&apos;authenticité d&apos;un produit enregistré sur Wazo Blockchain.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <Input value={hash} onChange={(e) => setHash(e.target.value)} placeholder="Référence hash" className="font-mono text-sm" required />
          <Button type="submit" className="w-full bg-indigo-700 hover:bg-indigo-800">Vérifier</Button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">
          <Link href="/login" className="underline">Espace professionnel</Link>
        </p>
      </div>
    </main>
  );
}

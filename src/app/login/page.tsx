"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0]">
          <Loader2 className="h-6 w-6 animate-spin text-[#075E54]" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

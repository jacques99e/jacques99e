"use client";

import Link from "next/link";
import { BookOpen, Calculator, ShoppingBasket, Sprout } from "lucide-react";

export default function AgriculturePage() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-[#075E54] px-4 py-4 text-white shadow-sm">
        <div className="mx-auto max-w-lg">
          <h1 className="text-lg font-semibold">Module Agriculture</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Link
          href="/agriculture/cultures"
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
        >
          <div className="rounded-xl bg-[#8B7355]/15 p-2">
            <Sprout className="h-5 w-5 text-[#8B7355]" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Suivi des cultures</p>
            <p className="text-xs text-gray-500">Parcelles, stades et suivi du semis</p>
          </div>
        </Link>

        <Link
          href="/agriculture/intrants"
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
        >
          <div className="rounded-xl bg-[#8B7355]/15 p-2">
            <BookOpen className="h-5 w-5 text-[#8B7355]" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Journal des intrants</p>
            <p className="text-xs text-gray-500">Engrais, pesticides, eau</p>
          </div>
        </Link>

        <Link
          href="/agriculture/rendement"
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
        >
          <div className="rounded-xl bg-[#8B7355]/15 p-2">
            <Calculator className="h-5 w-5 text-[#8B7355]" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Calculateur de rendement</p>
            <p className="text-xs text-gray-500">kg récoltés / hectare</p>
          </div>
        </Link>

        <Link
          href="/products/add?category=Agriculture"
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
        >
          <div className="rounded-xl bg-[#8B7355]/15 p-2">
            <ShoppingBasket className="h-5 w-5 text-[#8B7355]" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Vendre ma récolte</p>
            <p className="text-xs text-gray-500">Créer rapidement un produit agricole</p>
          </div>
        </Link>
      </main>
    </div>
  );
}

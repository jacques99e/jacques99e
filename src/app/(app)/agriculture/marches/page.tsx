"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, TrendingDown, TrendingUp, Minus, Save } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  readMarketPrices,
  writeMarketPrices,
  type MarketPrice,
} from "@/lib/agriculture-markets";
import { formatCurrency } from "@/lib/utils";

const trendIcon = { up: TrendingUp, down: TrendingDown, stable: Minus };
const trendColor = { up: "text-green-600", down: "text-red-600", stable: "text-gray-500" };

export default function AgricultureMarchesPage() {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrices(readMarketPrices());
  }, []);

  const updatePrice = (id: string, value: number) => {
    setPrices((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, priceFcfa: value, updatedAt: new Date().toISOString().slice(0, 10) }
          : p
      )
    );
    setSaved(false);
  };

  const save = () => {
    writeMarketPrices(prices);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <AppHeader title="Prix marchés" />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Link href="/agriculture" className="inline-flex items-center gap-2 text-sm text-[#8B7355]">
          <ArrowLeft className="h-4 w-4" /> Agriculture
        </Link>
        <p className="text-xs text-gray-600">
          Prix de votre marché local — modifiables et sauvegardés sur cet appareil.
        </p>
        <ul className="space-y-2">
          {prices.map((item) => {
            const Icon = trendIcon[item.trend];
            return (
              <li key={item.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{item.product}</p>
                    <p className="text-xs text-gray-500">{item.market}</p>
                  </div>
                  <Icon className={`h-4 w-4 ${trendColor[item.trend]}`} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={item.priceFcfa}
                    onChange={(e) => updatePrice(item.id, Number(e.target.value) || 0)}
                    className="h-9 text-sm"
                  />
                  <span className="text-xs text-gray-500">FCFA / {item.unit}</span>
                </div>
                <p className="mt-1 text-[10px] text-gray-400">
                  Réf. {formatCurrency(item.priceFcfa)} — MAJ {item.updatedAt}
                </p>
              </li>
            );
          })}
        </ul>
        <Button type="button" className="w-full bg-[#8B7355]" onClick={save}>
          <Save className="mr-1 h-4 w-4" />
          {saved ? "Prix enregistrés" : "Enregistrer mes prix"}
        </Button>
        <Link
          href="/products/add?category=Agriculture"
          className="block rounded-xl bg-[#8B7355]/90 p-4 text-center text-sm font-medium text-white"
        >
          Vendre ma récolte →
        </Link>
      </main>
    </>
  );
}

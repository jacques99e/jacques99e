"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, MapPin, RefreshCw, Save, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalizedMarketPrices } from "@/hooks/useLocalizedMarketPrices";
import { MARKET_REGION_OPTIONS } from "@/lib/agriculture-markets-regions";
import type { MarketPrice } from "@/lib/agriculture-markets";
import type { MarketRegionId } from "@/lib/agriculture-markets-regions";
import { formatCurrency } from "@/lib/utils";

const trendIcon = { up: TrendingUp, down: TrendingDown, stable: Minus };
const trendColor = { up: "text-green-600", down: "text-red-600", stable: "text-gray-500" };

export default function AgricultureMarchesPage() {
  const {
    prices,
    updatePrices,
    savePrices,
    location,
    regionLabel,
    regionId,
    regionPreference,
    selectRegion,
    loading,
    error,
    fromGps,
    source,
    refreshFromLocation,
  } = useLocalizedMarketPrices();
  const [saved, setSaved] = useState(false);

  const activeRegion = regionPreference || regionId;

  const updatePrice = (id: string, value: number) => {
    updatePrices((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, priceFcfa: value, updatedAt: new Date().toISOString().slice(0, 10) }
          : p
      )
    );
    setSaved(false);
  };

  const save = () => {
    savePrices(prices);
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

        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-600">
                Pays : <strong>{regionLabel || "…"}</strong>
                {source === "gps" ? " (GPS)" : source === "manual" ? " (choisi)" : ""}
              </p>
              {location ? (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{location}</span>
                </p>
              ) : null}
              {!fromGps && !loading && source !== "manual" ? (
                <p className="mt-1 text-[10px] text-amber-700">
                  GPS indisponible — sélectionnez votre pays ci-dessous.
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={refreshFromLocation}
              disabled={loading}
              title="Actualiser avec le GPS"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div>
            <Label htmlFor="market-country" className="text-xs text-gray-600">
              Mon pays / marché
            </Label>
            <select
              id="market-country"
              value={activeRegion || "west_africa"}
              onChange={(e) => selectRegion(e.target.value as MarketRegionId)}
              className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              {MARKET_REGION_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-gray-400">
              Si le GPS se trompe, choisissez votre pays ici — les prix se mettent à jour tout de suite.
            </p>
          </div>
        </div>

        {error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p> : null}

        {loading && !prices.length ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#8B7355] border-t-transparent" />
          </div>
        ) : (
          <ul className="space-y-2">
            {prices.map((item: MarketPrice) => {
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
        )}

        <Button type="button" className="w-full bg-[#8B7355]" onClick={save} disabled={loading || !prices.length}>
          <Save className="mr-1 h-4 w-4" />
          {saved ? "Prix enregistrés" : "Enregistrer mes prix"}
        </Button>
        <Link
          href="/agriculture/vendre"
          className="block rounded-xl bg-[#8B7355]/90 p-4 text-center text-sm font-medium text-white"
        >
          Vendre ma récolte →
        </Link>
      </main>
    </>
  );
}

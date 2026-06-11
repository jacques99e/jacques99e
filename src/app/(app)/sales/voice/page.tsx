"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, MicOff, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseVoiceSalePhrase, isSpeechRecognitionSupported } from "@/lib/voice-sales";
import { formatCurrency } from "@/lib/utils";

export default function VoiceSalesPage() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const applyParse = useCallback((text: string) => {
    setTranscript(text);
    const parsed = parseVoiceSalePhrase(text);
    setProduct(parsed.productHint);
    setQuantity(String(parsed.quantity));
    if (parsed.amountFcfa) setAmount(String(parsed.amountFcfa));
  }, []);

  const startListening = () => {
    setError("");
    if (!isSpeechRecognitionSupported()) {
      setError("Reconnaissance vocale non supportée sur ce navigateur. Utilisez Chrome ou Edge.");
      return;
    }
    const w = window as any;
    const SR = w.webkitSpeechRecognition || w.SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setError("Échec micro — vérifiez les permissions.");
    };
    rec.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      applyParse(text);
    };
    rec.start();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-[#075E54] px-4 py-4 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">Caisse Vocale</h1>
          <Link href="/sales" className="text-white/90">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="rounded-2xl bg-indigo-50 p-4 text-xs text-indigo-900">
          <strong>Première en Afrique :</strong> dictez « deux sacs de riz cinq mille » — Wazo remplit la vente.
          Parfait pour le marché sans clavier.
        </p>

        <div className="flex flex-col items-center rounded-2xl bg-white p-8 shadow-sm">
          <Button
            type="button"
            size="lg"
            className={`h-24 w-24 rounded-full ${listening ? "animate-pulse bg-red-600" : "bg-[#075E54]"}`}
            onClick={startListening}
            disabled={listening}
          >
            {listening ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
          </Button>
          <p className="mt-3 text-sm font-medium text-gray-700">
            {listening ? "Écoute en cours…" : "Appuyez et parlez"}
          </p>
          {transcript ? (
            <p className="mt-2 text-center text-xs italic text-gray-500">&quot;{transcript}&quot;</p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        </div>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Vente détectée</h2>
          <div>
            <Label>Produit</Label>
            <Input value={product} onChange={(e) => setProduct(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quantité</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Montant (FCFA)</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          {amount ? (
            <p className="text-sm font-bold text-[#075E54]">Total : {formatCurrency(Number(amount))}</p>
          ) : null}
          <Button asChild className="w-full">
            <Link
              href={`/sales?voice=1&product=${encodeURIComponent(product)}&qty=${quantity}&amount=${amount}`}
            >
              <ShoppingBag className="mr-1 h-4 w-4" /> Valider à la caisse
            </Link>
          </Button>
        </section>
      </main>
    </div>
  );
}

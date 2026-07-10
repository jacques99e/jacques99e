"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import {
  parseSaleLocally,
  type CatalogProduct,
  type ParsedSaleResult,
} from "@/lib/parse-sale-local";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface VoiceSaleButtonProps {
  products: CatalogProduct[];
  onParsed: (result: ParsedSaleResult) => void;
}

export function VoiceSaleButton({ products, onParsed }: VoiceSaleButtonProps) {
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const parseTranscript = async (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) {
      setError("Rien n’a été entendu. Réessayez.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let result: ParsedSaleResult | null = null;
      if (navigator.onLine) {
        try {
          const res = await apiFetch("/api/assistant/parse-sale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: cleaned, products }),
          });
          const data = (await res.json()) as ParsedSaleResult & {
            success?: boolean;
            error?: string;
          };
          if (res.ok && data.success) {
            result = data;
          }
        } catch {
          /* fallback local */
        }
      }
      if (!result) {
        result = parseSaleLocally(cleaned, products);
      }
      if (!result.items.length) {
        setError(
          `Aucun produit reconnu dans « ${cleaned} ». Exemple : « 2 riz et 1 huile ».`
        );
        return;
      }
      onParsed(result);
      setTranscript(cleaned);
    } finally {
      setLoading(false);
    }
  };

  const toggleListen = () => {
    setError("");
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setSupported(false);
      setError("Dictée vocale non supportée sur ce navigateur. Utilisez Chrome/Android.");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = true;
    let finalText = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += `${piece} `;
        else interim += piece;
      }
      setTranscript((finalText + interim).trim());
    };

    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed") {
        setError("Autorisez le micro pour dicter une vente.");
      } else if (event.error !== "aborted") {
        setError("Dictée interrompue. Réessayez.");
      }
    };

    recognition.onend = () => {
      setListening(false);
      const text = finalText.trim() || transcript.trim();
      if (text) void parseTranscript(text);
    };

    recognitionRef.current = recognition;
    setTranscript("");
    setListening(true);
    recognition.start();
  };

  return (
    <div className="rounded-2xl border border-[#075E54]/20 bg-gradient-to-br from-emerald-50 to-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#075E54]">Vente à la voix</p>
          <p className="text-[11px] text-gray-600">
            Ex. « Deux riz et une huile, Mobile Money »
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className={
            listening
              ? "bg-red-600 hover:bg-red-700"
              : "bg-[#075E54] hover:bg-[#064e47]"
          }
          disabled={loading || !products.length}
          onClick={toggleListen}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : listening ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          {loading ? "Analyse…" : listening ? "Stop" : "Dicter"}
        </Button>
      </div>

      {!supported ? (
        <p className="mt-2 text-xs text-amber-700">
          Navigateur sans reconnaissance vocale — tapez la phrase ci-dessous.
        </p>
      ) : null}

      <div className="mt-2 flex gap-2">
        <input
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Ou tapez : 2 riz, 1 huile"
          className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || !transcript.trim()}
          onClick={() => void parseTranscript(transcript)}
        >
          OK
        </Button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Scan, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useI18n } from "@/contexts/I18nContext";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose?: () => void;
}

/** Barcode: manual entry + camera preview (QuaggaJS optional in production). */
export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const { t } = useI18n();
  const [manual, setManual] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!cameraActive) return;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() => setCameraActive(false));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [cameraActive]);

  const submitManual = () => {
    if (manual.trim()) {
      onScan(manual.trim());
      setManual("");
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{t("products.barcode")}</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {cameraActive && (
        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
            Saisissez le code ou intégrez QuaggaJS
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder={t("products.barcode")}
          onKeyDown={(e) => e.key === "Enter" && submitManual()}
        />
        <Button type="button" size="icon" variant="outline" onClick={submitManual}>
          OK
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setCameraActive(!cameraActive)}
      >
        <Scan className="h-4 w-4" />
        {t("products.scan")}
      </Button>
    </div>
  );
}

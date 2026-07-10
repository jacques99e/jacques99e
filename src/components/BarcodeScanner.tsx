"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Scan, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useI18n } from "@/contexts/I18nContext";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose?: () => void;
}

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("whatsapp") || ua.includes("fbav") || ua.includes("instagram");
}

function mapCameraError(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

  if (!window.isSecureContext) {
    return "La caméra nécessite une connexion HTTPS sécurisée.";
  }
  if (isInAppBrowser()) {
    return "Ouvrez l'app dans Chrome (menu ⋮ → Ouvrir dans le navigateur) pour utiliser la caméra.";
  }
  if (
    message.includes("notallowed") ||
    message.includes("permission") ||
    message.includes("denied")
  ) {
    return "Autorisez l'accès à la caméra dans les paramètres du navigateur.";
  }
  if (message.includes("notfound") || message.includes("devices")) {
    return "Aucune caméra détectée sur cet appareil.";
  }
  return "Caméra indisponible. Saisissez le code manuellement.";
}

async function pickCameraId(
  Html5Qrcode: typeof import("html5-qrcode").Html5Qrcode
): Promise<string | { facingMode: string }> {
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras.length) {
      return { facingMode: "environment" };
    }
    const back =
      cameras.find((c) => /back|rear|environment|arrière/i.test(c.label)) ??
      cameras[cameras.length - 1];
    return back.id;
  } catch {
    return { facingMode: "environment" };
  }
}

async function startScannerWithFallback(
  scanner: import("html5-qrcode").Html5Qrcode,
  Html5Qrcode: typeof import("html5-qrcode").Html5Qrcode,
  onDecode: (text: string) => void
): Promise<void> {
  const scanConfig = {
    fps: 10,
    qrbox: (width: number, height: number) => {
      const edge = Math.min(width, height);
      const box = Math.max(180, Math.floor(edge * 0.75));
      return { width: box, height: Math.floor(box * 0.55) };
    },
  };

  const cameraId = await pickCameraId(Html5Qrcode);
  const candidates: Array<string | { facingMode: string }> = [
    cameraId,
    { facingMode: "environment" },
    { facingMode: "user" },
  ];

  const seen = new Set<string>();
  let lastError: unknown;

  for (const camera of candidates) {
    const key = typeof camera === "string" ? camera : camera.facingMode;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      await scanner.start(camera, scanConfig, onDecode, () => {});
      return;
    } catch (e) {
      lastError = e;
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch {
        /* retry next camera */
      }
    }
  }

  throw lastError ?? new Error("Camera start failed");
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const { t } = useI18n();
  const [manual, setManual] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const regionId = useId().replace(/:/g, "");
  const onScanRef = useRef(onScan);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);

  onScanRef.current = onScan;

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      /* ignore stop races */
    }
  }, []);

  useEffect(() => {
    if (!cameraActive) {
      void stopScanner();
      setStarting(false);
      return;
    }

    let cancelled = false;
    setError("");
    setStarting(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
          if (cancelled) return;

          if (!document.getElementById(regionId)) {
            throw new Error("Scanner UI not ready");
          }

          const scanner = new Html5Qrcode(regionId, {
            verbose: false,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.ITF,
            ],
          });
          scannerRef.current = scanner;

          await startScannerWithFallback(scanner, Html5Qrcode, (decodedText) => {
            if (cancelled) return;
            onScanRef.current(decodedText);
            setCameraActive(false);
          });

          if (!cancelled) setStarting(false);
        } catch (err) {
          if (cancelled) return;
          setError(mapCameraError(err));
          setCameraActive(false);
          setStarting(false);
        }
      })();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void stopScanner();
    };
  }, [cameraActive, regionId, stopScanner]);

  const submitManual = () => {
    if (manual.trim()) {
      onScan(manual.trim());
      setManual("");
    }
  };

  const toggleCamera = () => {
    setError("");
    setCameraActive((active) => !active);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("products.barcode")}</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {cameraActive ? (
        <div className="space-y-2">
          <div
            id={regionId}
            className="min-h-[220px] overflow-hidden rounded-lg bg-black [&_video]:!max-h-72 [&_video]:w-full"
          />
          <p className="text-center text-xs text-gray-500">
            {starting
              ? "Activation de la caméra…"
              : "Placez le code-barres ou le QR dans le cadre"}
          </p>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

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
        className="w-full gap-2"
        onClick={toggleCamera}
        disabled={starting}
      >
        <Scan className="h-4 w-4" />
        {cameraActive ? "Arrêter la caméra" : t("products.scan")}
      </Button>
    </div>
  );
}

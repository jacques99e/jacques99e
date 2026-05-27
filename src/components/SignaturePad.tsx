"use client";

import { useRef } from "react";
import { Button } from "./ui/button";
import { useI18n } from "@/contexts/I18nContext";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
}

export function SignaturePad({ onSave }: SignaturePadProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const getCtx = () => canvasRef.current?.getContext("2d");

  const start = (x: number, y: number) => {
    const ctx = getCtx();
    if (!ctx) return;
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (x: number, y: number) => {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#075E54";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const pointer = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (e.type === "pointerdown") start(x, y);
    else if (e.type === "pointermove") draw(x, y);
    else drawing.current = false;
  };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = getCtx();
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
  };

  const save = () => {
    const c = canvasRef.current;
    if (c) onSave(c.toDataURL("image/png"));
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={300}
        height={120}
        className="w-full touch-none rounded-lg border bg-white"
        onPointerDown={pointer}
        onPointerMove={pointer}
        onPointerUp={pointer}
        onPointerLeave={pointer}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          {t("common.cancel")}
        </Button>
        <Button type="button" size="sm" onClick={save}>
          {t("logistics.sign")}
        </Button>
      </div>
    </div>
  );
}

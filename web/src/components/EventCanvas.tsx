"use client";

import { useEffect, useRef } from "react";

export interface EventPoint {
  x: number;
  y: number;
  polarity: number;
}

export default function EventCanvas({
  points,
  frameW,
  frameH,
  label,
}: {
  points: EventPoint[];
  frameW: number;
  frameH: number;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frameW <= 0 || frameH <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const canvasW = canvas.width;
    const canvasH = canvas.height;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Background
    ctx.fillStyle = "#070a0e";
    ctx.fillRect(0, 0, canvasW, canvasH);

    const scaleX = canvasW / frameW;
    const scaleY = canvasH / frameH;

    // Draw events
    for (const point of points) {
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y)
      ) {
        continue;
      }

      const x = point.x * scaleX;
      const y = point.y * scaleY;

      if (x < 0 || x > canvasW || y < 0 || y > canvasH) {
        continue;
      }

      ctx.fillStyle =
        point.polarity > 0 ? "#d9e5ef" : "#71879b";

      ctx.fillRect(
        Math.floor(x),
        Math.floor(y),
        Math.max(1, Math.ceil(scaleX)),
        Math.max(1, Math.ceil(scaleY))
      );
    }
  }, [points, frameW, frameH]);

  return (
    <div className="min-w-0">
      <div
        className="
          relative
          aspect-square
          w-full
          overflow-hidden
          rounded-[14px]
          border
          border-[#dfe4e9]
          bg-[#070a0e]
          shadow-[0_8px_24px_rgba(20,28,38,0.06)]
        "
      >
        <canvas
          ref={canvasRef}
          width={128}
          height={128}
          className="block h-full w-full"
          aria-label={label}
        />

        {/* Subtle inner frame */}
        <div className="pointer-events-none absolute inset-0 rounded-[14px] border border-white/[0.04]" />

        {/* Corner markers */}
        <div className="pointer-events-none absolute left-2.5 top-2.5 h-3 w-3 border-l border-t border-white/20" />
        <div className="pointer-events-none absolute right-2.5 top-2.5 h-3 w-3 border-r border-t border-white/20" />
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 h-3 w-3 border-b border-l border-white/20" />
        <div className="pointer-events-none absolute bottom-2.5 right-2.5 h-3 w-3 border-b border-r border-white/20" />

        {/* Minimal label */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-[6px] border border-white/[0.10] bg-black/45 px-2 py-1 backdrop-blur-md">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-white/55">
            Event Vision
          </span>
        </div>

        {/* Event legend */}
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-3 rounded-[6px] border border-white/[0.10] bg-black/45 px-2.5 py-1.5 backdrop-blur-md">
          <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d9e5ef] shadow-[0_0_5px_rgba(217,229,239,.35)]" />
            ON
          </span>

          <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-[#71879b] shadow-[0_0_5px_rgba(113,135,155,.3)]" />
            OFF
          </span>
        </div>
      </div>

      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.10em] text-[#7b838d]">
        {label}
      </p>
    </div>
  );
}
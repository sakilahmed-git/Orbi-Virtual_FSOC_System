"use client";

import { useEffect, useRef } from "react";

export default function BaselineCanvas({
  pixels,
  width,
  height,
  label,
  caption,
}: {
  pixels: number[] | null;
  width: number;
  height: number;
  label: string;
  caption?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels || width === 0 || height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;

    const offCtx = off.getContext("2d");
    if (!offCtx) return;

    const imageData = offCtx.createImageData(width, height);

    for (let i = 0; i < width * height; i++) {
      const v = pixels[i] ?? 0;

      imageData.data[i * 4] = v;
      imageData.data[i * 4 + 1] = v;
      imageData.data[i * 4 + 2] = v;
      imageData.data[i * 4 + 3] = 255;
    }

    offCtx.putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = false;

    // Premium neutral canvas background
    ctx.fillStyle = "#080b0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
      off,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [pixels, width, height]);

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
          bg-[#080b0f]
          shadow-[0_8px_24px_rgba(20,28,38,0.06)]
        "
      >
        <canvas
          ref={canvasRef}
          width={128}
          height={128}
          className="block h-full w-full"
        />

        {/* Subtle inner frame */}
        <div className="pointer-events-none absolute inset-0 rounded-[14px] border border-white/[0.04]" />

        {/* Technical corner markers */}
        <div className="pointer-events-none absolute left-2.5 top-2.5 h-3 w-3 border-l border-t border-white/20" />
        <div className="pointer-events-none absolute right-2.5 top-2.5 h-3 w-3 border-r border-t border-white/20" />
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 h-3 w-3 border-b border-l border-white/20" />
        <div className="pointer-events-none absolute bottom-2.5 right-2.5 h-3 w-3 border-b border-r border-white/20" />

        {/* Image type */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-[6px] border border-white/[0.10] bg-black/45 px-2 py-1 backdrop-blur-md">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-white/55">
            Baseline
          </span>
        </div>

        {/* Resolution indicator */}
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-[6px] border border-white/[0.10] bg-black/45 px-2 py-1 backdrop-blur-md">
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/45">
            {width} × {height}
          </span>
        </div>
      </div>

      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.10em] text-[#7b838d]">
        {label}
      </p>

      {caption && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#737a84]">
          {caption}
        </p>
      )}
    </div>
  );
}